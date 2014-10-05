// make dataset globally available

var sFileChartGroup = "FileListGroup";  // temporary, for the File List table
var sChartGroupRoot = "grp";
var sChartGroup = "one";                // temporary, for all Slide charts


// load miso dataset and create table
gda = (function(){
'use strict';

var gda = {
    version: "0.099",
    minor:   "60",
    branch:  "gdca-dev",

    T8hrIncMsecs     : 1000*60*60*8,      // 8 hours
    TdayIncMsecs     : 1000*60*60*24,     // 1 day
    TweekIncMsecs    : 1000*60*60*24*7,   // 1 week
    TmonthIncMsecs   : 1000*60*60*24*30,  // 1 month
    TquarterIncMsecs : 1000*60*60*24*91,  // 1 quarter
    TyearIncMsecs    : 1000*60*60*24*365, // 1 year


    _allowEdit : false, //true,  // for charts. need to set when slide is 'selected', from bAllowOverrides, etc.
    _anchorEdit : null,     // document element, where Slide Edit controls are placed
    _anchorNav : null,      // document element, where Slide Navigation controls are placed
    _anchorSlide : null,    // document element, where the Slide is placed

    _currentSlide : 0,           // active slide in set
    _slidefile : "",
    _slide: function() {
                var sl = gda.slides.list();
                return sl[gda._currentSlide];
            },
    cf : null,              // data is aggregated in crossfilter
    myCols : {              // selections, really just the current checkboxes selected in the control section.
        "csetupChartCols" : [],     // which columns are selected for chart creation; no benefit to persistence.
                                    // stored in each chart when configured
        "csetupHiddenTableCols" : [],// which Table columns to hide
                                    // stored in a slide, only 1 table supported. Need Table obj
        "csetupSortTableCols" : []// which Table column(s) to sort upon
    },
    selCols : [],           // selected

    // these are the 'active' display
                            // these get a DC chart object when 'displayed'
    selectors : [],         // definition of the selector
    selCharts : [],
    charts : [],
    tables : [],
    dimensions : [],
    dateDimension : null,
    bDashOnly : false,
                                // current slide's state
    bShowTable : false,         // show a data table ?
    bShowDataSource : false,    // offset interface to choose a(nother) data file?
    bShowSlidesSource : false,  // offer interface to view other slide sets?
    bAccessOverrides: false,
    bFirstRowOnly : false,
    nFirstRows : 100,

    // registered simple or aggregated charts
    availCharts : ["Timeline", "Scatter", "Pareto", "Bar", "Row", "Line", "Hist", "Series", "Bubble", "ScatterHist", "Choropleth", "Stats"], // "YHist" //  
    //availCharts : ["Bar","Bubble"],
    numFormats : [".2f", "%Y%m%d", ".0f" ],
    defFormat : 0,
    runGrpNumber : 0
};

gda.numberFormat = d3.format(gda.numFormats[gda.defFormat]);
gda.dateFormat = d3.time.format(gda.numFormats[1]);  // hmm not great
gda.daysFormat = d3.format(gda.numFormats[2]); 


    //gda.datasource(gda.newDataSourceState());

gda.newDataSourceState = function() {
    var _aDatasource = {};
    _aDatasource.dataprovider = "";
    _aDatasource.datafile = "";
    _aDatasource.bLoaded = false;
    _aDatasource.bListOfMany = false;
    _aDatasource.bLocalFile = true;
    _aDatasource.bAggregate = false;

    return _aDatasource;
}
gda.datasource = function( _datasource ) {
    var _aDatasource = _datasource ? _datasource : {};
    // expand as needed

    return _aDatasource;
}

gda.allowEdit = function() {
    return gda._allowEdit || gda.bAccessOverrides;
}

// Presently there is only an 'active' selections state. Need persistable content.
// Table (has 'singleton' (OBS); needs name, type, options; each needs hidden columns (per table instance) )
// Dims  (has col name; needs name, type, options)
// Chart (represents current selections, perhaps best to go back to gda.?)

gda.newSlideState = function() {
    var _aSlide = {};
    _aSlide.title = "Blank";

    // data source related, refactor into a data source
    _aSlide.dataprovider = "";
    _aSlide.datafile = "";
    _aSlide.bLoaded = false;
    _aSlide.bListOfMany = false;
    _aSlide.bLocalFile = true;
    _aSlide.bAggregate = false;
    _aSlide._idCounter = 0;

    // data source as applied on this slide
    _aSlide.columns = [];   // columns available, from previously loaded data
    _aSlide.keymap = {};
    _aSlide.filters = {};

    // Dimension 'selector charts' chosen, by 'column'.
    _aSlide.myCols = {              // selections, really just the current checkboxes selected in the control section.
        "csetupDimsCols" : [],      // which Dim charts are selected/shown
        "csetupHiddenTableCols" : [],// default hidden columns for table
        "csetupSortTableCols" : []   // column(s) selected for table sort
    };

    // chart related
    _aSlide.charts = [];            // newChartState's.

    // table related, refactor into table
    _aSlide.bUseTable = false;          // whether table should be used/allowed on this slide
    _aSlide.bShowTable = false;          // whether table should be shown on this slide
    _aSlide.bShowDataSource = false;    // maybe these should be implemented as Slide overrides. However no method implemented yet to remove an override
    _aSlide.bShowSlidesSource = false;  // offer interface to view other slide sets?

    _aSlide.bAllowOverrideChanges = false;
    _aSlide.bAccessOverrides = false;
    _aSlide.bShowTableColumnSelectors = true; // whether table column hide selectors should be available to user
    _aSlide.bShowLinksInTable = false;  // move to table definition when added
    _aSlide.bShowPicturesInTable = false;
    return _aSlide;
};

// prototype for a Chart: Title, col dims, chart type
gda.newChartState = function() {
    var _aChart = {};
    _aChart.Title = "Blank"+dc.utils.uniqueId();
    _aChart.myCols = {              // selections, really just the current checkboxes selected in the control section.
        "csetupChartCols" : []      // which columns are used for chart creation
    };
    _aChart.type = "";              // none chosen by default
    _aChart.sChartGroup = "";
    return _aChart;
};

gda.chart = function( _chart ) {    // used to decorate a chart definition for operations
    var _aChart  = _chart ? _chart : {};
    _aChart.__dc_flag__ = dc.utils.uniqueId();
    _aChart.remove = function () {
        gda.removeChart(__dc_flag__); 
    };
    _aChart.titleCurrent = function(text) {
        // update stored slide definition
        var aChart = _.findWhere(gda._slide().charts, {Title: _aChart.Title});
        aChart.Title =  text ? text : "Blank"+dc.utils.uniqueId();
        _aChart.Title = aChart.Title;
        // redraw anything?
        if (aChart.titleEl) {
            aChart.titleEl.innerHTML = chtObj.Title;//"";	8/17/2014
        //    var dTxtT = gda.addTextNode(aChart.titleEl,chtObj.Title);
        }
    };

//  _aChart.settingCurrent = function(setting,text) {
//      // update stored slide definition
//      var aChart = _.findWhere(gda._slide().charts, {Title: _aChart.Title});
//      aChart[setting] =  text ? text : _aChart[setting];
//      _aChart[setting] = aChart[setting];
//  };
    return _aChart;
};

gda.utils = {};
gda.utils.fieldExists = function(f) {
        if (f === undefined) return false;
        if ((typeof f) === undefined) return false;
        return true;
    };
gda.utils.labelFunction = function (d) {
            if (typeof(d)==="string") {
            return d.key.trim() === "" ? "(blank)" : d.key;
            }
            else return d.key;
        };
gda.utils.titleFunction = function (d,v,i) {
            if (gda.utils.fieldExists(d.key) && gda.utils.fieldExists(d.value) && d.key.trim) {
                return (d.key.trim() === "" ? "(blank)" : d.key ) + ": " + d.value ;
            } else if (gda.utils.fieldExists(d.data) && gda.utils.fieldExists(d.data.key) && gda.utils.fieldExists(d.data.value) && d.data.key.trim) {
                return (d.data.key.trim() === "" ? "(blank)" : d.data.key ) + ": " + d.data.value ;
            } else
                return "(N/A)";
        };
gda.utils.addDateOptions = function(d,base,tier) {
    var insHere = d;
    if (tier !== null && tier !== undefined) {
        if (!gda.utils.fieldExists(d[tier]))
            d[tier] = {};
        insHere = d[tier];
    }
    insHere.Year = d3.time.year(base);
    insHere.Quarter = 1+Math.floor(d3.time.month(base).getMonth()/3); // this one isn't supported by D3 (yet).
    insHere.Month = d3.time.month(base);
    insHere.Week = d3.time.week(base);
    insHere.Day = d3.time.day(base);
    insHere.DoW = base.getDay();
};

gda.addOverride = function( anObj, key, value ) {
        if (!anObj.overrides) 
            anObj.overrides = {};
        if (!gda.utils.fieldExists(anObj.overrides[key])) {
            anObj.overrides[key] = value;
        }
};

// this 'slide' is just the information content, not the page representation
gda.slide = function( _slide ) {
    var _aSlide  = _slide ? _slide : {};
    var __dc_flag__ = dc.utils.uniqueId();
    var _name = "blank"+dc.utils.uniqueId();    // 'next' slide
    var _anchorSlide = gda._anchorSlide; //(dEl) ? dEl : gda._anchorSlide;   // the document element passed in

    // this should be in a 'datasource'. Used only for data counting
    _aSlide.uniqueId = function () { return ++(_aSlide._idCounter); };  // missing! _idCounter
    _aSlide.myId = 0;

    _aSlide.name = function(txt) {
        if (txt) _name = txt;
        return _name;
    };
    _aSlide.restore = function(data) {
    };
    ///////////////////////////////////////////////////////////////////
    // add data to the set used.
    ///////////////////////////////////////////////////////////////////

    _aSlide.clear = function() {
        gda._slide().columns = [];
        gda._slide().keymap = {};
        gda._slide().filters = {};
        gda.clearWorkingState();
    };
    _aSlide.clearDisplay = function() {
        if (gda._anchorSlide) gda._anchorSlide.innerHTML = "";
        dc.deregisterAllCharts(sChartGroup);
    };
    // starts with a slide clear (and data structures) since the view level uses this to change pages
    _aSlide.display = function() {   // move to view.
        console.log("slide.display from " + gda._currentSlide + " to " +  _aSlide.myId);
        gda._currentSlide = _aSlide.myId;

        // set gda's control state up with slide specifics
        gda.myCols.csetupHiddenTableCols = gda._slide().myCols.csetupHiddenTableCols;
        gda.myCols.csetupSortTableCols = gda._slide().myCols.csetupSortTableCols;
        gda.bShowTable = gda._slide().bShowTable;
        gda.bShowDataSource  = gda._slide().bShowDataSource;
        gda.bShowSlidesSource = gda._slide().bShowSlidesSource;

        gda.clearWorkingState();
        _aSlide.clearDisplay();
        gda.displayCharts();  //9/8/2014 readded
        _aSlide.refreshControls();  // all
        var bDeferredDisplay = false;
     //   if (gda.utils.fieldExists(gda._slide().bLocalFile) &&
     //      (gda._slide().bLocalFile))
     //   {
     //   console.log("slide.display: file " + gda._slide().datafile);
     //   if (gda._slide().datafile) {
                        // For a csv file, this is: folder + file
            bDeferredDisplay = gda.fileLoadImmediate ();    // could do this with a callback passed in
     //   }
     //   }
     //   else
     //   {
     //       console.log("slide.display: provider " + gda._slide().dataprovider);
     //       if (gda._slide().dataprovider) {
     //           bDeferredDisplay = gda.fileLoadImmediate ();    // could do this with a callback passed in
     //       }
     //   }

        console.log("slide.display: continuing after fLoadI");
        if (!bDeferredDisplay) {
            console.log("slide.display: !deferred");
            //_aSlide.displayPopulate();
        }
        else
            console.log("slide.display: deferred!");
    };

    _aSlide.displayPopulate = function() {   // fill controls, such as after file load has finished
        // for editing:
        // need 'display' for balance of slide controls (see dataComplete's showColumnChoices)

        gda.showAvailable();    // when editing, and 1+ columns are chosen "Choose Chart Data"
                                // this displays suitable choice examples, along with an 'Add' button
        gda.updateDimCharts();  // displays the Selector charts
        //gda.displayCharts();  //9/8/2014 readded. displayPopulate used in redraw
        gda.regenerateCharts(); // displays the Informational charts

        gda.updateChartCols(false); // default = none checked

        var s1 = document.getElementById('setupDimsCols');
        if (s1) {
            s1.innerHTML = "";
            gda.showColumnChoices(gda._slide(),s1,'csetupDimsCols', gda._slide().myCols.csetupDimsCols, gda.colDimCheckboxChanged );
        }

        // for 'run' mode display:
        // plus the actual slide , but need auto chart generation from stored def first
        //gda.displayCharts();  //5/15/2014 remakes charts for what reason?
        gda.regenerateTotalReset();

        gda.applySlideFilters();

        // does designer want it used, and, does user want to see it
//        if (gda._slide().bUseTable && gda.bShowTable) {   // gda.showTable manages this, after slide.display updates gda.bShowTable
                                        // does designer want user to be able to change visible columns
            gda.showTable();    // does a regenerateTable internally
//        }
        //gda.regenerateTable(gda.bShowTable);  5/15/2014 double called, already in gda.showTable

    };

    _aSlide.anchorName = function () {
            var a = _anchorSlide;
            if (a && a.id) return a.id;
            if (a && a.replace) return a.replace('#','');
            return "" + slideID();
    };
    _aSlide.slideID = function () {
            return __dc_flag__;
    };
    _aSlide.refreshControls = function(sChartGroup) {
            var dHostEl = gda._anchorSlide;

            document.title = _aSlide.title;

            dHostEl.innerHTML = "";
            var dEl = gda.addElement(dHostEl,"h2");
                var dTxtT = gda.addTextNode(dEl,_aSlide.title);

            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","MyCharts");
            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","MySelectors");
            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","TotalReset");

            // just adds the document elements for the tables
            // could make dependent on bShowTable

            var dTb = gda.addElement(dHostEl,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dEl = gda.addElement(dTd,"div");
                        dEl.setAttribute("class","row");
                            gda.addElementWithId(dEl,"div","FileTable");
                    var dTd = gda.addElement(dTr,"td");
                        var dElDT = gda.addElement(dTd,"div");
                        dElDT.setAttribute("class","row");
                            gda.addElementWithId(dEl,"div","DataTable");

            var dElBr = gda.addElement(dHostEl,"br");
            var dTxtT = gda.addTextNode(dHostEl,"Version " +gda.version+"."+gda.minor + " " + gda.branch);
    };

    _aSlide.addDisplayChart = function(sChtGroup) {     // temp workaround, just adds the most recently added chart
            var docEl = document.getElementById('MyCharts');
            gda.addDisplayChart(docEl, gda.charts.length-1, gda._anchorEdit ? gda.addEditsToSelectedChart  : false);
            // would like to render just this chart
			console.log("renderALL gda.slide.addDisplayChart");
            dc.renderAll(sChtGroup);
            //gda.charts[iChart].chart.render();
    };
    _aSlide.refresh = function(sChtGroup) {
            var docEl = document.getElementById('MyCharts');
            docEl.innerHTML = "";
            // if editing, allow removal of a chart
            // 9/8/14 gda.displayCharts();  //5/15/2014 moved to here, generate then display, like Avail.
            gda.addDisplayCharts(docEl, sChtGroup, gda.allowEdit() ? gda.addEditsToSelectedChart  : false);
    };
    return _aSlide;
};

gda.applySlideFilters = function(filters) {
    console.log("aSF: " + JSON.stringify(filters));
    if (gda.cf) {
    console.log("aSF: have gdf");
    if (!arguments.length) filters = gda._slide().filters;
        console.log("aSF: now " + JSON.stringify(filters));
        if (filters) {
            _.each(filters, function(f,key) {
                //if (f.length>0)
                 {
                    var _aSel = _.findWhere(gda.selCharts, {"Title": key});
                    if (_aSel) {
                        _aSel.chart.filterAll();
                        _.each(f, function(value) {
                            _aSel.chart.filter(value);
                        });
                        _aSel.chart.redraw();
                    } else {
                        var _aChart = _.findWhere(gda.charts, {"Title": key});
                        if (_aChart) {
                            _aChart.chart.filterAll();
                            _.each(f, function(value) {
                                _aChart.chart.filter(value);
                            });
                            _aChart.chart.redraw();
                        }
                    }
                }
            });
            dc.redrawAll(sChartGroup);    // other charts need it
        }
    }
}

gda.showAvailable = function() {
if (gda.cf) { //gda.myCols.csetupChartCols.length>0) {//}
    var s1 = document.getElementById('AvailChoices');
    if (s1) {
        gda.chooseFromAvailCharts(s1,gda.cf,gda.myCols.csetupChartCols, gda.addSelectedChart);//, sChartGroup );
    }
    }
}

// creates a chart container and adds to the slide state's chart list
// needs to change to generate from the slide state's chart list
gda.addSelectedChart = function(tObj){//, sChtGroup) { //aclass) {
    var aclass = tObj.class;
    var aChart = gda.newChartState(); // eventually, gda.chart(gda.newChartState());
    aChart.myCols.csetupChartCols = JSON.parse(JSON.stringify(gda.myCols.csetupChartCols)); // retain selections
    aChart.sChartGroup = sChartGroup;
    aChart.type = aclass;    // this.class
    gda._slide().charts.push(aChart);   // add to the end for now. View dependent. Could drag-n-drop eventually
    gda.addLastChart();

    gda._slide().addDisplayChart(aChart.sChartGroup);
}

gda.removeChart = function(chtId) {
    console.log("removeChart " + JSON.stringify(chtId));
    // remove from definition, then repaint.
    // or optimize and remove from active slides, and repaint just document element.

    gda._slide().charts =
        _.filter(gda._slide().charts, function(chtObj) {
            return chtObj.__dc_flag__ !== chtId;
        });
}

gda.addEditsToSelectedChart = function(tObj) {
    var chtId = tObj.value;
    var _aChart = _.findWhere(gda.charts, {"__dc_flag__": +chtId}); // or should use the doc id ?
    if (_aChart) {
		gda.addEditsToChart(_aChart);
        gda.updateChartCols(_aChart.cnameArray);    // slide().charts[n].myCols.csetupChartCols
    }
}

gda.addEditsToChart = function(_aChart) {
	var s3 = document.getElementById(_aChart.dElid);
	if (s3 && s3.parentNode && s3.parentNode.id) {
		var s4 = document.getElementById(s3.parentNode.id+"controls");
		if (s4) {
			s4.innerHTML = "";
			gda.addButton(s4, "deleteChart", "X", function() {      // but not for selector PieCharts
				gda.removeSelectedChart(_aChart.__dc_flag__)//chtId)
			});
            gda.addEditControls(_aChart, s4);
		}
	}
}

gda.addEditControls = function(_aChart, s4) {
			var dTb = gda.addElement(s4,"table");
				var dTr = gda.addElement(dTb,"tr");
					var dTd = gda.addElement(dTr,"td");
					gda.addTextEntry(dTd, "Title", _aChart.Title,
							function(newVal, fieldName) {  // adopt same form as below  .Title as a function
							_aChart.titleCurrent(newVal);	// use for several side effects
							//_aChart[fieldName] = _aChart.overrides[fieldName] = newVal;
										_.each(gda._slide().charts, function(sChart) {
											if (_aChart.Title === sChart.Title)
												sChart.overrides = _aChart.overrides;	// update store.
										});
                                        gda.view.redraw();  // 8/21/2014 for override edit
							});
                var bWidth = false;
                var bHeight = false;
				if (_aChart.overrides) {
					_.each(_aChart.overrides, function(value, key) {
                        if (key === "wChart") bWidth = true;
                        if (key === "hChart") bHeight = true;
                    });
                }
                if (!bWidth) {
				var dTr = gda.addElement(dTb,"tr");
					var dTd = gda.addElement(dTr,"td");
					gda.addTextEntry(dTd, "wChart", _aChart.wChart,
							function(newVal, fieldName) {
							//_aChart.settingCurrent("wChart",newVal);
                            if (!_aChart.overrides)
                                _aChart.overrides = {};
							_aChart[fieldName] = _aChart.overrides[fieldName] = newVal;
										_.each(gda._slide().charts, function(sChart) {
											if (_aChart.Title === sChart.Title)
												sChart.overrides = _aChart.overrides;	// update store.
										});
                                        gda.view.redraw();  // 8/21/2014 for override edit
							});
                }
                if (!bHeight) {
				var dTr = gda.addElement(dTb,"tr");
					var dTd = gda.addElement(dTr,"td");
					gda.addTextEntry(dTd, "hChart", _aChart.hChart,
							function(newVal, fieldName) {
							//_aChart.settingCurrent("hChart",newVal);
							_aChart[fieldName] = _aChart.overrides[fieldName] = newVal;
										_.each(gda._slide().charts, function(sChart) {
											if (_aChart.Title === sChart.Title)
												sChart.overrides = _aChart.overrides;	// update store.
										});
                                        gda.view.redraw();  // 8/21/2014 for override edit
							});
                }

				if (_aChart.overrides) {
					_.each(_aChart.overrides, function(value, key) {
						var dTr = gda.addElement(dTb,"tr");
							var dTd = gda.addElement(dTr,"td");
							gda.addTextEntry(dTd, key, value,
									function(newVal, fieldName) {
										//console.log("field " + fieldName + " override " + _aChart.overrides[fieldName] + " " + newVal);
                                        if (typeof(newVal)==="string") {
                                            if (newVal === "false") newVal = false;     // otherwise "false" is 'true'
                                            else if (newVal === "true") newVal = true;  // for consistency
                                        }
										_aChart[fieldName] = _aChart.overrides[fieldName] = newVal;

										// reformat slide/json to store charts as named objects, rather than array, simplifies this kind of update
										_.each(gda._slide().charts, function(sChart) {
											if (_aChart.Title === sChart.Title)
												sChart.overrides = _aChart.overrides;	// update store.
										});
                                        gda.view.redraw();  // 8/21/2014 for override edit
									});
					});
				}
				var dTr = gda.addElement(dTb,"tr");
					var dTd = gda.addElement(dTr,"td");
					gda.addTextEntry(dTd, "Add Field", "Blank",
							function(newField) {
								if (!_aChart.overrides)
									_aChart.overrides = {};
								_aChart.overrides[newField] = "Blank";
								gda.addEditsToChart(_aChart);
								});
		}

gda.removeSelectedChart = function(chtId) {
    //console.log("removeSelectedChart? " + this.checked + " " + JSON.stringify(this));
    console.log("removeSelectedChart " + JSON.stringify(chtId));
    // remove from slide state, and slide definition
    // which one? need to store/check the identifier for the chart, from radio button
    var _aChart = _.findWhere(gda.charts, {"__dc_flag__": +chtId}); // or should use the doc id ?
    if (_aChart) {
        gda.charts =    // remove chart from active
            _.filter(gda.charts, function(chtObj) {
                return chtObj.__dc_flag__ !== _aChart.__dc_flag__; // or should use the doc id ?
            });
        dc.deregisterChart(_aChart.chart, _aChart.sChartGroup);
//      var s3 = document.getElementById(_aChart.dElid);
//      s3.innerHTML = "";
        gda._slide().charts =   // remove chart definition
            _.filter(gda._slide().charts, function(chtObj) {
                return chtObj.Title !== _aChart.Title;  // better name them !
            });
        gda.view.redraw();
    }
}

gda.colTabCheckboxChanged = function() {
  //console.log("cTCbC");
  var col = this.value;
  var c = this.class;
  var checked = this.checked;
  if (checked) {
    //console.log("added   col " + col);
    gda.myCols[c].push(col);
  }
  else {
    //console.log("removed col " + col);
    gda.myCols[c] = _.without(gda.myCols[c],col);
  }
    // if editing, update the slide defaults
    if (gda._anchorEdit) {
        gda._slide().myCols.csetupHiddenTableCols = gda.myCols.csetupHiddenTableCols;
        gda._slide().myCols.csetupSortTableCols = gda.myCols.csetupSortTableCols;
    }
  gda.regenerateTable(gda.bShowTable);
}

gda.colDimCheckboxChanged = function() {
  //console.log("cDCbC");
  var col = this.value;
  var c = this.class;
  var checked = this.checked;
  if (checked) {
    //console.log("added   col " + col);
    gda._slide().myCols[c].push(col);
  }
  else {
    //console.log("removed col " + col);
    gda._slide().myCols[c] = _.without(gda._slide().myCols[c],col);
    if (gda.hasSelector(col)) {
        gda.removeSelector(col, sChartGroup);
    }
  }

  gda.updateDimCharts();
}

// this controls populating the 'available chart' choices, not the slide contents
gda.colCheckboxChanged = function() {
    //console.log("cCbC");
    var col = this.value;
    var c = this.class;
    //console.log("cCbC col class " + col +" "+ c);
    var checked = this.checked;
    if (checked)
        gda.myCols[c].push(col);
    else
        gda.myCols[c] = _.without(gda.myCols[c],col);

    gda.showAvailable();
}

gda.updateChartCols = function(defV) {
    var s1 = document.getElementById('setupChartCols');
    if (s1) {
        s1.innerHTML = "";

        gda.showColumnChoices(gda._slide(),s1,'csetupChartCols', defV, gda.colCheckboxChanged );
    }
}

gda.updateDimCharts = function() {
    _.each(gda._slide().myCols.csetupDimsCols, function(col,i) {
        if (!gda.hasSelector(col)) {
            gda.newSelector(col, sChartGroup, "pieChart");  // needs options ?
        }
    });
    gda.redrawDimCharts();
}

gda.redrawDimCharts = function() {
    var s3 = document.getElementById('MySelectors');
    s3.innerHTML = "";
    gda.addSelectorCharts(s3);
}

gda.showFilters = function() {
    var dEl = document.getElementById('MySelectors');
    if (dEl) {
        _.each(gda.charts, function(aChart,i) {
            var c = aChart.chart;
            if (c.filter) { //c.hasFilter()) { // }
                var fv = c.filters();
                var dTxtT = gda.addTextNode(dEl,aChart.Title + " : " + JSON.stringify(aChart.cnameArray) + " : " + fv); // and what is c.filters() in comparison
                var dElBr = gda.addElement(dEl,"br");
            }
        });
        _.each(gda.selCharts, function(aChart,i) {
            var c = aChart.chart;
            if (c.filter) { //c.hasFilter()) { // }
                var fv = c.filters();
                var dTxtT = gda.addTextNode(dEl,aChart.Title + " : " + JSON.stringify(aChart.cnameArray) + " : " + fv); // and what is c.filters() in comparison
                var dElBr = gda.addElement(dEl,"br");
            }
        });
    }
}

gda.showFilter = function(c,f) {
    var dEl;// = document.getElementById('MySelectors');
    if (dEl) {
        if (c.hasFilter()) {
        var fv = c.filters();
        var dTxtT = gda.addTextNode(dEl,c.gdca_chart.Title + " : " + fv);
        var dElBr = gda.addElement(dEl,"br");
        }
        else {
        var dTxtT = gda.addTextNode(dEl,c.gdca_chart.Title + " : filter cleared");
        var dElBr = gda.addElement(dEl,"br");
        }
    }
    if (c.gdca_chart) {
        var fv = c.filters();
        gda._slide().filters[c.gdca_chart.Title] = fv;
        if (c.gdca_chart.filterEl) {
            c.gdca_chart.filterEl.innerHTML = "";
			var txt = gda._slide().filters[c.gdca_chart.Title];
			if (txt.length>0) {
			txt = JSON.stringify(txt);
			txt = txt.replace(/,/g,", ");
			if (txt.length === 0) txt = "-";
            //var dTxtT = gda.addTextNode(c.gdca_chart.filterEl,txt);	8/17/2014
            c.gdca_chart.filterEl.innerHTML = txt;
			}
        }
    }
}


// need 'table removal', and do so before redisplay
gda.regenerateTable = function(bShowTable) {
    var s8 = document.getElementById('DataTable');
    s8.innerHTML = "";

    // requires a dimension for now
    if (bShowTable && gda.cf && gda.myCols.csetupSortTableCols.length>0) {

    var diff = _.difference(gda._slide().columns,gda.myCols.csetupHiddenTableCols);
    gda.dateDimension = gda.cf.dimension(function (d) {
                return d[gda.myCols.csetupSortTableCols[0]]; // just first one, for now
            });
    var iTable = gda.createTable(gda.cf, gda.dateDimension, diff, sChartGroup, gda._slide().bShowLinksInTable, gda._slide().bShowPicturesInTable, JSON.parse(JSON.stringify(gda.myCols))  );// myCols changes, need to retain state
    gda.newTableDisplay(s8,iTable);
	console.log("renderALL gda.regenerateTable");
    dc.renderAll(sChartGroup);
    }
}

gda.regenerateTotalReset = function() {
    var dEl = document.getElementById('TotalReset');
    if (dEl) {
        dEl.innerHTML = "";
        if (gda.cf) {
            var sDcData = dEl.id+dc.utils.uniqueId();
                    var dEla = gda.addElement(dEl,"a");
                        dEla.setAttribute("href","javascript:gda.tablesReset("+0+",sChartGroup);");
                        var dTxtT = gda.addTextNode(dEla,"Reset All");

        }
    }
}

gda.regenerateCharts = function() {
    gda._slide().refresh(sChartGroup);
}

gda.dataComplete = function() {
    var sl = gda.slides.list();

    sl[gda._currentSlide].bLoaded = true;   // should be in the datasource
    console.log("gda.dataComplete columns " + gda._slide().columns);

    gda.view.show();
}

// presently updates #2 and calls regenerateTable for #3
            // 1. Use Table (shown in Editor)
            // 2. Table Controls (shown when table Use is selected, edit or run).
            // 3. Table Display
gda.showTable = function() {
    //if (gda._slide().bUseTable)
    {
        var s3 = document.getElementById('slideUseTable');
        if (s3) {
        s3.innerHTML = "";
        gda.addCheckB(s3, "useTable", "Use Table", 'objmember',
                gda._slide().bUseTable, 
                function () {
                    gda._slide().bUseTable = this.checked;
                    // need method to refresh the Nav controls when un/checked
                    gda.showTable();
                    gda.view.redraw();
                } );
        }
        var s3 = document.getElementById('slideUseOverrides');
        if (s3) {
        s3.innerHTML = "";
        gda.addCheckB(s3, "useOverrides", "Allow Overrides", 'objmember',
                gda._slide().bAllowOverrideChanges, 
                function () {
                    gda._slide().bAllowOverrideChanges = this.checked;
                    gda.view.redraw();
                } );
        }
    }

    var s3 = document.getElementById('setupTable');
    s3.innerHTML = "";
    var bLocalShowTable = false;
    if (gda._slide().bShowTable && gda._slide().columns && gda._slide().columns.length>0) {
        gda.addCheckB(s3, "showHiders", "Show Table Option Configuration", 'objmember',
                gda._slide().bShowTableColumnSelectors, 
                function () {
                    gda._slide().bShowTableColumnSelectors = this.checked;
                    gda.showTable();
                    //gda.view.redraw();    // could add, to workaround slide.next.tablechecked.notabledisplayed bug
                                            // at expense of a full redraw.
                                            // need to fix checkbox management instead
                                            // so for now, uncheck recheck to display (user).
                    } );
        if (gda._anchorEdit) {  // only show this item if editing
            var dEl = gda.addElement(s3,"br");
            gda.addCheckB(s3, "FirstRow", "Abort Load after First " + gda.nFirstRows + " Rows", 'objmember',
                    gda.bFirstRowsOnly, 
                    function () {
                        gda.bFirstRowsOnly = this.checked;
                        //gda._slide().bLoaded = false;
                        gda.datafile = null;   // override to force reload
                        gda.dataprovider = null;   // override to force reload  added .38
                        gda.fileLoadImmediate();
                        gda.showTable();
                        } );
            var dEl = gda.addElement(s3,"br");
            gda.addCheckB(s3, "showLinks", "Display Http as Links", 'objmember',
                    gda._slide().bShowLinksInTable, 
                    function () {
                        gda._slide().bShowLinksInTable = this.checked;
                        gda.showTable();
                        } );
            gda.addCheckB(s3, "showPictures", "Display Pictures", 'objmember',
                    gda._slide().bShowPicturesInTable, 
                    function () {
                        gda._slide().bShowPicturesInTable = this.checked;
                        gda.showTable();
                        } );
        }
        if (gda._slide().bShowTableColumnSelectors ) {
            // sorting key(s)
            var dEl = gda.addElement(s3,"br");
            var dEl = gda.addElement(s3,"strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Column to Sort Table");
            var dElt = gda.addElementWithId(s3,"div","setupSortTableCols");
                gda.showColumnChoices(gda._slide(),dElt,'csetupSortTableCols', gda.myCols.csetupSortTableCols, gda.colTabCheckboxChanged );

            // hidden columns
            var dEl = gda.addElement(s3,"br");
            var dEl = gda.addElement(s3,"strong");
                var dTxtT = gda.addTextNode(dEl,"Choose any Columns to Hide from Table");
            var dElt = gda.addElementWithId(s3,"div","setupHiddenTableCols");
                gda.showColumnChoices(gda._slide(),dElt,'csetupHiddenTableCols', gda.myCols.csetupHiddenTableCols, gda.colTabCheckboxChanged );
        }
        bLocalShowTable = true;
    }
    gda.regenerateTable(bLocalShowTable);
};

// temporary, don't expose eventually
gda.showColumnChoices = function(lgda,dEl,colArrayName,defV, changedCallback) {
    _.each(lgda.columns, function(cname) {
    if (jQuery.isArray(defV)) {
        gda.addCheckB(dEl, cname, cname, colArrayName, _.contains(defV, cname), changedCallback);
    } else {
        gda.addCheckB(dEl, cname, cname, colArrayName, defV, changedCallback);
    }
    });
};

gda.slideRegistry = function() {
    var _slideMap;
    var _file = ""; // slide persistence file!

    function initializeSlideSet() {
        if (!_slideMap)  {
            _slideMap = [];
        }
    }

    return {
//      load: function(filename) {  // old, eliminate
//          _file = filename;
//          d3.csv(_file, function(data) {
//              console.log("d3.csv loaded: "+JSON.stringify(data));
//              // set key,values to our state
//              _.each(data, function(value, key) {    // just (key) if parseRows is used.
//                  if (key === "slides") {
//                      _.each(value, function(aSlide, slideKey) {    // just (key) if parseRows is used.
//                          gda.slides.append(gda.slide.restore(aSlide));
//                      });
//                  }
//                  else {
//                      gda.slides[key] = value;
//                  }
//              });
//          });
//      },
        asText: function() {
            var sl = gda.slides.list();
            var t = JSON.stringify(sl);
            return t;
        },
        anchorName: function () {
            var a = gda._anchorSlide;
            if (a && a.id) return a.id;
            if (a && a.replace) return a.replace('#','');
            return "" + slidesID();
        },


        ///////////////////////////////////////////////////////////////////
        // remove, clear
        ///////////////////////////////////////////////////////////////////
        remove: function (i) {
            var i = +i;
            if (i>=0 && i < _slideMap.length) {
            //for (var i = 0; i < _slideMap.length; i++) {
                //if (_slideMap[i].anchorName() === slide.anchorName()) {
                    _slideMap.splice(i, 1);
                //    break;
                //}
            }
        },


        has: function(slide) {
            //if (_slideMap.indexOf(slide) >= 0)
            _.each(_slideMap, function(s) {
                if (s === slide)
                    return true;
            });
            return false;
        },

        clear: function() {
            initializeSlideSet();
            _slideMap = [];
        },

        list: function() {
            initializeSlideSet();
            return _slideMap;
        }
    };
}();

gda.Controls = function() {
    return {
        addEditGUI: function() {
            var dHostEl = gda._anchorEdit;

            var dEl = gda.addElement(dHostEl,"br");

            gda.addButton(dHostEl,"insSlide", "Insert Slide", gda.view.insert);
            gda.addButton(dHostEl,"addSlide", "Append Slide", gda.view.append);

            //var dEl = gda.addElement(dHostEl,"br");

            gda.addButton(dHostEl,"clearState", "Clear Slide", gda.view.clear);
            gda.addButton(dHostEl,"delSlide", "Remove Slide", function() {gda.view.remove(gda._currentSlide);});
            gda.addButton(dHostEl,"refresh", "Refresh Slide", gda.view.redraw);

            var dEl = gda.addElement(dHostEl,"br");

            // slide Title
            var doChartEl = gda.addElementWithId(dHostEl,"div","slideTitleEntry");

            var dEl = gda.addElement(dHostEl,"br");

            // one of 3 sections of table support.
            // 1. Use Table (shown in Editor)
            // 2. Table Controls (shown when table Use is selected, edit or run).
            // 3. Table Display
            var docEl = gda.addElementWithId(dHostEl,"div","slideUseTable");
            var docEl = gda.addElementWithId(dHostEl,"div","slideUseOverrides");

if (false) {
            gda.addCheckB(dHostEl, "useTable", "Use Table", 'objmember',
                    gda._slide().bUseTable, 
                    function () {
                        gda._slide().bUseTable = this.checked;
                        // need method to refresh the Nav controls when un/checked
                        gda.showTable();
                        gda.view.redraw();
                    } );
}

            var dEl = gda.addElement(dHostEl,"h3");
                var dTxtT = gda.addTextNode(dEl,"Column Setup");
            var dTxtT = gda.addTextNode(dHostEl,"Check to choose a column, select chart type via radio button. Uncheck before choosing another (except for Scatterplots).");

            var dEl = gda.addElement(dHostEl, "br");

            var dEl = gda.addElement(dHostEl, "strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Chart Data");
            var dElt = gda.addElementWithId(dHostEl,"div","setupChartCols");

            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","AvailChoices");

            var dEl = gda.addElement(dHostEl, "strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Dimension Selectors");
            var dElt = gda.addElementWithId(dHostEl,"div","setupDimsCols");
        },

        addNavGUI: function() {
            var dHostEl = gda._anchorNav;

            var dElS = gda.addElementWithId(dHostEl,"div","slideSet");

            if (gda._slide()) {
            if (gda._slide().bUseTable) {
            gda.addCheckB(dHostEl, "showTable", "Show Table", 'objmember', //temp, use Nav anchor to "show on Slide"
                    gda.bShowTable, 
                    function () {
                        gda.bShowTable = this.checked;
                        gda._slide().bShowTable = gda.bShowTable;
                        gda.showTable();
                    });
            }

            if (gda._slide().bAllowOverrideChanges) {
            gda.addCheckB(dHostEl, "accessOverrides", "Access Overrides", 'objmember',
                    gda.bAccessOverrides, 
                    function () {
                        gda.bAccessOverrides = this.checked;
                        gda._slide().bAccessOverrides = gda.bAccessOverrides;
                        gda.view.redraw();
                    });
            }
            }

            // Control location where table controls will be added
            var doChartEl = gda.addElementWithId(dHostEl,"div","setupTable");
            // temp, use Nav anchor to show on slide, until table construction software is completed.
        }
    };
}();

gda.slides = function() {
    
    gda.slideRegistry.clear();
    console.log("gda.slides: ready ===============================1");
    return {
        clear: function() {
            gda.slideRegistry.clear();
            gda.slides.append();
        },
        fileAdd: function(filepath) {
            console.log(" fileAdd: is this used? ====== ");
            // split into datafile and provider (folder).
            var i = filepath.lastIndexOf("/");
            if (i<0)
                i = filepath.lastIndexOf("\\"); // allow either form
            if (i>0 && i<filepath.length-1) {
                var filename = filepath.substring(i+1);
                var folderpath = filepath.substring(0,i+1); // retain separator
                gda._slide().datafile = filename;   // retain for Slide setup, may already be set
                gda._slide().dataprovider = folderpath;   // retain for Slide setup, may already be set  fixed was .provider .38
            } else { 
                if (gda.utils.fieldExists(gda._slide().bLocalFile) && !gda._slide().bLocalFile)
                    gda._slide().dataprovider = filepath;
                else
                    gda._slide().datafile = filepath;   // assume local (last) folder and just a filename
                
                    
            }
            gda.fileLoadImmediate();
        },
        dataAdd: function(data) {
            console.log("who is using this =X==X==X==X==X==X==X=");
            // needs refactor, no keymap etc
            if (!gda.cf) 
                gda.new_crossfilter();
            dataAdd(data);
            //gda.dataArrayAdd(columns,dR); 
            //gda.dataComplete();
        },
        //controls: function(dElN,dElS) {   // retired.
        //  if (dElN) { gda._anchorNav = dElN; }
        //  if (dElS) { gda._anchorSlide = dElS; }
        //},
        run: function(slidespath,dElN,dElS,optFilters) {
            console.log("optFilters: ",JSON.stringify(optFilters));
            //sChartGroup = sChartGroupRoot + gda.runGrpNumber;   // temp hack to try mult runs
            //console.log("sCG " + sChartGroup + ", " + gda.runGrpNumber);
            //gda.runGrpNumber++;

            gda._anchorEdit = null;
            if (dElN) { gda._anchorNav = dElN; }
            if (dElS) { gda._anchorSlide = dElS; }
            //gda._slidefile = slidespath;
//if (gda.slides.list().length === 0)
//    gda.view.append();
            //gda.slides.show();
             gda.bDashOnly = false;
             if (optFilters) {
                console.log("optFilters");
                //gda.applySlideFilters (optFilters);
                if (typeof(optFilters)==="string")
                    optFilters = JSON.parse(optFilters);
                if (gda.utils.fieldExists(optFilters.bDashOnly))
                    gda.bDashOnly = true;
             }
             gda.slidesLoadImmediate(slidespath, gda.bDashOnly);    // add slidepath immediate load
             if (optFilters) {
                console.log("optFilters, gda.dH");
                gda.deferredHash = optFilters;
             }
        },
        edit: function(dElC,dElN,dElS) {   // control
            gda._allowEdit = true;
            if (dElC) { gda._anchorEdit = dElC; }
            if (dElN) { gda._anchorNav = dElN; }
            if (dElS) { gda._anchorSlide = dElS; }
            if (gda.slides.list().length === 0)
                gda.view.append();
        },
        // 'internal'
        list: function() {
            return gda.slideRegistry.list();
        },
        //current: function() {
        //  //if (gda._currentSlide<gda.slides.length)
        //    return gda.slideRegistry.list()[gda._currentSlide];
        //},
        titleCurrent: function(text) {
            gda._slide().title = text ? text : "Blank";
            document.title = gda._slide().title;
            gda.view.showList();    // update navigation buttons
        },

        ///////////////////////////////////////////////////////////////////
        // two methods to 'add' slides, insert (before current), and append
        ///////////////////////////////////////////////////////////////////
        insert: function(slide) {
            if (!slide) slide = gda.slide(gda.newSlideState());
            gda.slideRegistry.list().splice(gda._currentSlide, 0, slide);
        },

        append: function(slide) {
            if (!slide) slide = gda.slide(gda.newSlideState());
            gda.slideRegistry.list().push(slide);
        },
        remove: function(i) {
            gda.slideRegistry.remove(i);
        },

        ///////////////////////////////////////////////////////////////////
        // 
        ///////////////////////////////////////////////////////////////////
        createContentDataSource: function(dHostEl) {
            var dTb = gda.addElement(dHostEl,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dEl = gda.addElement(dTd,"h3");
                var dTxtT = gda.addTextNode(dEl,"Data Source");
                    var dTd = gda.addElement(dTr,"td");
            var dTb = gda.addElement(dTd,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","dataProviderType");
                        gda.addRadioB(dCEl, "SLFile", "SLFile", "Local File", 'objmemberSource', gda._slide().bLocalFile, 
                                function () {
                                    console.log("as Local");
                                    gda._slide().bLocalFile = true;
                                    gda.view.redraw();
                            })
                            .addRadioB(dCEl, "SHttp", "SHttp", "Http Source", 'objmemberSource', !gda._slide().bLocalFile, 
                                function () {
                                    console.log("as Http");
                                    gda._slide().bLocalFile = false;
                                    gda.view.redraw();
                            });

                //var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var doChartEl = gda.addElementWithId(dTd,"div","dataProviderEntry");
                if (gda.utils.fieldExists(gda._slide().bLocalFile) && !gda._slide().bLocalFile) {
                    var dTd = gda.addElement(dTr,"td");
                        var dTxtT = gda.addTextNode(dTd,"https://mysafeinfo.com/content/datasets");
                }

                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","dataFileQty");
                        gda.addRadioB(dCEl, "One", "One", "Single CSV File", 'objmember', !gda._slide().bListOfMany, 
                                function () {
                                    console.log("newOne");
                                    gda._slide().bListOfMany = false;
                            })
                            .addRadioB(dCEl, "Many", "Many", "CSV File of File List", 'objmember', gda._slide().bListOfMany, 
                                function () {
                                    console.log("newMany");
                                    gda._slide().bListOfMany = true;
                            });

                    var dTd = gda.addElement(dTr,"td");
                        gda.addCheckB(dTd, "aggregate", "Aggregate Data", 'objmember', false, 
                                function () {
                                    console.log("Aggregate? " + this.checked);
                                    gda._slide().bAggregate = this.checked;
                        });
                if (!gda.utils.fieldExists(gda._slide().bLocalFile) || gda._slide().bLocalFile) {
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        gda.addUploader(dTd, "uploader");
                        var dEl = gda.addElementWithId(dTd,"span","dataFilenameDisplay");
                }
            }
    };
    gda.slides.clear(); // initialize upon first use
    console.log("gda.slides: ready ===============================2");
}();

//////////////
// per 'slide' meaning active state support

// clear the active state
//gda.clear = function() {
//    gda.slides.clear();
//    gda.new_crossfilter();
    //gda.cf = null;
//    gda.defFormat = 0;
//};

// clear all the slides, but not the CF
gda.clearAllSlides = function() {
    gda.clearWorkingState();
    gda.slides.clear();
};


// moving 'view' operators to here, from gda.slides
gda.view = function() {
    return {
        clear: function() {         // clears all contents from this slide. effectively delele/new/show.
            gda.clearWorkingState();       // update model
            gda.view.redraw();
        },
        remove: function() {
            if (gda.slideRegistry.list().length === 1) {
                gda.slides.append();    // append new one, to replace last/current
            }
            gda.slides.remove(gda._currentSlide);
            if (gda._currentSlide>gda.slideRegistry.list().length-1)
                gda._currentSlide = gda.slideRegistry.list().length-1;
            gda.view.redraw();
        },
        insert: function() {
            gda.slides.insert();
            // gda._currentSlide stays as-is.
            gda.view.redraw();
        },
        append: function() {
            gda.slides.append();
            gda._currentSlide = gda.slideRegistry.list().length-1;
            gda.view.redraw();
        },
        show: function() {
            gda.view.redraw();
        },
        showPrev: function() {
            var iPrev = gda._currentSlide-1;
            if (iPrev<0)
                iPrev = 0;
            else {
                gda._currentSlide = iPrev;
                gda.view.redraw();
            }
        },
        showNext: function() {
            var iNext = gda._currentSlide+1;
            var sl = gda.slides.list();
            if (iNext>=sl.length)
               iNext = sl.length-1;
            else {
                gda._currentSlide = iNext;
                gda.view.redraw();
            }
        },
        showList: function() {                  // needs renaming, or refactor below, used for slide specific control values
            // slide 'control palette' items
            var docEl = document.getElementById('slideSet');
            if (docEl) {
                docEl.innerHTML = "";

                if (gda._anchorEdit || gda.bShowSlidesSource) {
                    var dTb = gda.addElement(docEl,"table");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dEl = gda.addElement(dTd,"h3");
                                    var dTxtT = gda.addTextNode(dEl,"Slides Source");
                            var dTd = gda.addElement(dTr,"td");

                // temp; slide set open moved here to allow use in Run mode
                                gda.addSlideOpen(dTd, "openSlides");
                                var dEl = gda.addElementWithId(dTd,"span","slideFilenameDisplay");
                if (gda._anchorEdit)
                                    gda.addButton(dTd,"saveState", "Save Slides", gda.saveState);
                }

                // if run mode, but requested, show this next to the SlideSet chooser
                if (!gda._anchorEdit && gda.bShowDataSource) {
                    var dElD = gda.addElementWithId(docEl,"div","DataSource");
                    gda.slides.createContentDataSource(dElD);
                }
                  
                var sl = gda.slides.list();
                if (sl.length>1) {
                    var dElBr = gda.addElement(docEl,"br");
                    var sNo = 1;
                    //gda.addButton(docEl, "showFilters", "F", gda.applySlideFilters);
                    gda.addButton(docEl, "showSlideP", "<", gda.view.showPrev);
                    gda.addButton(docEl, "showSlideN", ">", gda.view.showNext);
                    _.each(sl, function(s) {
                        var i = s.title.length;
                        if (s.title.length>9) {
                            i = s.title.indexOf(" ");
                            if (i>0 && i<9) {
                                var j = s.title.substring(i+1).indexOf(" ");
                                if (j>1) i = i + j + 1;
                            }
                            if (i=== -1) i=9;
                        }
                        var bLabel = s.title.substring(0,i);//9);//""+sNo;
                        //console.log("sNo " + sNo + " bLabel " + bLabel);
                        //bLabel = bLabel +": "+s.name();
                        sl[sNo-1].myId = sNo-1;   // workaround
                        gda.addButton(docEl, "showSlide"+(sNo-1), bLabel,//sl[sNo-1].display;
                            function(thisB) {
                                    var i = thisB.id.indexOf("showSlide");
                                    if (i>=0) {
                                        i = i + "showSlide".length;
                                        i = thisB.id.substring(i);
                                        i = +i;
                                        gda._currentSlide = i;
                                        gda.view.redraw();
                                    }
                        });
                        sNo++;
                    });
                }
            }

            // slide specific items, poss refactor as hinted above

            var dElTE = document.getElementById("slideTitleEntry");
            if (dElTE) {    // prob belongs elsewhere
            dElTE.innerHTML = "";
            gda.addTextEntry(dElTE, "Slide Title", gda._slide().title,
                    function(newVal) {  // adopt same form as below  .title as a function
                    gda.slides.titleCurrent(newVal); // was _name =
                    });

            var dElDPE = document.getElementById("dataProviderEntry");
            dElDPE.innerHTML = "";
            gda.addTextEntry(dElDPE, (!gda.utils.fieldExists(gda._slide().bLocalFile) || gda._slide().bLocalFile) ? "Folder" : "Provider", gda._slide().dataprovider,
                    function(newVal) {
                        if (!gda.utils.fieldExists(gda._slide().bLocalFile) || gda._slide().bLocalFile) {
                        if (!(endsWith(newVal,"/") || endsWith(newVal,"\\")))
                            newVal = newVal + "\\";  // preserve form?
                        }
                        gda._slide().dataprovider = newVal;
                    });
            }
            var dElFDE = document.getElementById("dataFilenameDisplay");
            if (dElFDE) {
            dElFDE.innerHTML = "";
            var dTxtT = gda.addTextNode(dElFDE,gda._slide().datafile);
            if (gda._slide().dataLastModifiedDate)
                var dTxtT = gda.addTextNode(dElFDE," ("+gda._slide().dataLastModifiedDate+")");
            }

            var dElFDE = document.getElementById("slideFilenameDisplay");
            if (dElFDE) {
            dElFDE.innerHTML = "";
            var dTxtT = gda.addTextNode(dElFDE,gda._slidefile);
            if (gda._slideLastModifiedDate)
                var dTxtT = gda.addTextNode(dElFDE," ("+gda._slideLastModifiedDate+")");
            }
        },
// need a distinction between redrawing everything, and just the charts. The redraw implementation
// causes complete removal of charts and cf dims etc and recreates. Only the ChartTypeDisplay() needs
// to be refreshed.
        redraw: function() {
            if (gda._anchorEdit) {
                gda._anchorEdit.innerHTML = "";  // call operators
                gda.Controls.addEditGUI();
                gda.slides.createContentDataSource(gda._anchorEdit);
            }
            if (gda._anchorNav) {
                gda._anchorNav.innerHTML = "";
                gda.Controls.addNavGUI();
            }
            if (gda._anchorSlide) {
                //gda._anchorSlide.innerHTML = "";
                gda._slide().clearDisplay();    // clear displayed contents
                gda._slide().refreshControls(); // some standard HTML controls need forced refresh
                //gda.slides.show();  // moved from first in block
                    gda.view.showList();    // was after slide display, below
                                                //var sl = gda.slides.list();
                    gda._slide().display();
                gda._slide().displayPopulate() 
            }
        },
    };
}();

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}


gda.clearWorkingState = function() {
    _.each(gda.dimensions, function(dimset) {
        dimset.dDim.dispose();   // [name,dim]
    });
    gda.dimensions = [];        // working dimensions for selectors etc.
    gda.selCols = [];           // working selection of columns for selectors, temp
    gda.selCharts = [];
    gda.selectors = [];        // definition of the selector
    gda.charts = [];                // definition of a chart
    gda.tables = [];                // definition of a tables
};

gda.sampleData = function(ndims) {
    var sd = [];
    for(var iN = 0; iN<10; iN++) {
        var oneDatum = [];
        for(var iD = 0; iD<ndims; iD++) {
            oneDatum.push(Math.random()*10);
        }
        sd.push(oneDatum);
    }
    return sd;
};

// Eventually have them just provide one document element, and supply our own
// divs as necessary.
gda.chooseFromAvailCharts = function(docEl,cf,columns,callback) {
    var sChtGroup = docEl.id;//"avail";   // for available charts, use the document id as the group

    // clear out earlier incarnations
    docEl.innerHTML = "";
    dc.deregisterAllCharts(sChtGroup);
    gda.charts =
    _.filter(gda.charts, function(chtObj) {
        return chtObj.sChartGroup !== sChtGroup;
    });

    if (columns && columns.length>0) {
        _.each(gda.availCharts, function(chartType) {
            gda.newChart(cf, "Choice", columns, sChtGroup, chartType,
                                      {"nBins":"10",
                                       "wChart":"300",
                                       "hChart":"200"});  // gda overrides
        });
        // need some way to choose from these. Could be dependent on how they are presented.
        // such as a column, or grid; integrate the radio button into the display, flagged
        // visible and enabled when choosing?
        gda.addDisplayCharts(docEl,sChtGroup, callback);
    }
}

gda.displayCharts = function() {
    if (gda.cf) {
    gda.charts = [];    // workaround
        _.each(gda._slide().charts, function(aChart) {
            if (!gda.bDashOnly || (gda.utils.fieldExists(aChart.bDashInclude) && aChart.bDashInclude)) {
            gda.newChart(gda.cf, aChart.Title, aChart.myCols.csetupChartCols, aChart.sChartGroup, aChart.type, aChart.overrides);
            }
        });
    }
}

gda.addLastChart = function() {
    if (gda.cf) {
        var aChart = gda._slide().charts[gda._slide().charts.length-1];
        gda.newChart(gda.cf, aChart.Title, aChart.myCols.csetupChartCols, aChart.sChartGroup, aChart.type);
    }
}

gda.dimensionByCol = function(cname,cf,bFilterNonNumbers, nFixed) {
    var res;
    var aDimObj = _.findWhere(gda.dimensions, {dName: cname, dFilter: bFilterNonNumbers, dFixed: nFixed});
    if (!aDimObj && cf) {
        res = cf.dimension(function (d) {
            //return d[cname];
            var v = bFilterNonNumbers ? +d[cname] : d[cname];
	    if (nFixed !== undefined && nFixed !== null) {
		    v = v.toFixed(nFixed);
	    }
            return bFilterNonNumbers ? ( (isNaN(v))?0.0:v ) : v;
            });
        gda.dimensions.push({dName: cname, dFilter: bFilterNonNumbers, dFixed: nFixed, dDim: res});
        console.log("dBC: " + JSON.stringify(gda.dimensions));
    }
    else if (aDimObj) {
        res = aDimObj.dDim;
        console.log("dBC: exists " + cname);
    }
    return res;
}

// separate model and view (creation of the objects from the view container)
gda.newSelector = function(cname, sChtGroup, chartType) {
    console.log("gda nS: add " + chartType + " " + cname);
    var dDim = gda.dimensionByCol(cname,gda.cf);
    if (dDim) {
    var dGrp = dDim.group();
    var selObj = new Object();
    selObj.cname = cname;
    selObj.dDim = dDim;
    selObj.dGrp = dGrp;
    selObj.chartType = chartType;
    selObj.sChartGroup = sChtGroup;
    gda.selectors.push( selObj );
    gda.selCols.push(cname);
    return selObj;
    }
    return null;
};

gda.hasSelector = function(cname) {
    return _.contains(gda.selCols, cname);  // selCols can go away if selObj.cname is used
};

gda.removeSelector = function(cname, sChtGroup) {
    gda.selectors = _.filter(gda.selectors, function(selObj) { return selObj.cname !== cname || selObj.sChartGroup !== sChtGroup; });
    gda.selCols = _.filter(gda.selCols, function(selCol) { return selCol !== cname });
};

// view element creators
// adds new dc pieChart under dElIdBase div
gda.addSelectorCharts = function(docEl) {
    var sGroups = [];
    _.each(gda.selectors, function(selObj,i) {
        var doChartEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId());//i;//dElIdBase+i;   // nth view chart element
        console.log("gda aSC: _id " + doChartEl.id + " i col grp " + i + " " + selObj.cname + " " + selObj.sChartGroup);

        selObj.chart = gda.newSelectorDisplay(i, selObj.chartType, doChartEl, selObj.cname, selObj.dDim,selObj.dGrp,selObj.sChartGroup);
        // xxx add chart edit controls here

        if (!_.contains(sGroups,selObj.sChartGroup))
            sGroups.push(selObj.sChartGroup);
    });
    _.each(sGroups, function(sGroup) {
		console.log("renderALL gda.addSelectorCharts");
        dc.renderAll(sGroup);
    });
}

// adds new dc pieChart under docEl div with a new div
gda.newSelectorDisplay = function(i, chartType, docEl, cname,dDim,dGrp,sChtGroup) {
    var fn = 'newSelector'+chartType;        // function name template
    return gda.newSelectorPieChart(i, docEl,cname,dDim,dGrp,sChtGroup);        // gda.fn() or gda[fn]() ???
}

// change the embedded javascript to use this instead gda.selectorReset("+cname+","+sChtGroup+";);"
gda.selectorsReset = function(cname,sChtGroup) {        // needs chart group too.
    gda.selectors[cname].chart.filterAll(sChtGroup);
    dc.redrawAll(sChtGroup);
}

// ! charts need unique ids instead of indices, for naming and access !
gda.chartsReset = function(cname,sChtGroup) {        // needs chart group too.
    gda.charts[cname].chart.filterAll(sChtGroup);
    dc.redrawAll(sChtGroup);
}
gda.tablesReset = function(cname,sChtGroup) {        // needs chart group too.
    //gda.tables[cname].chart.filterAll(sChtGroup);
    dc.filterAll(sChtGroup);
	console.log("renderALL gda.chartsReset");
    dc.renderAll(sChtGroup);
}

// adds new dc pieChart under div dEl as a new sub div
gda.newSelectorPieChart = function(i, dEl,cname,dDim, dGrp, sChtGroup) {
    var chtObj= {};
    chtObj.Title = cname;
    gda.addOverride(chtObj,"legend",false);
    var dStr = gda.addElement(dEl,"h3");
        var dTitleEl = gda.addElementWithId(dStr,"div",dEl.id+dc.utils.uniqueId());
        chtObj.titleEl = dTitleEl;
    //var dEl1 = dEl;
	var dEl1 = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());

    addDCdiv(dEl1, "selectors", i, cname, sChtGroup); // add div for DC chart

    chtObj.Title = cname;
    gda.selCharts.push(chtObj);
    //var ftChart = dc.pieChart("#"+dEl.id,sChtGroup);
    var ftChart = dc.pieChart("#"+dEl1.id,sChtGroup);
    chtObj.chart = ftChart;
    ftChart.gdca_chart = chtObj;
    ftChart
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(200)
        .height(200)
        .radius(90)
        .dimension(dDim)
        .slicesCap(20)
        .group(dGrp)
        .label(gda.utils.labelFunction)
        .title(gda.utils.titleFunction)
        .renderLabel(true)
        .innerRadius(0)
        .transitionDuration(0); // ms
    if (chtObj.overrides["legend"])
        ftChart
            .legend(dc.legend());
    var dElCenter = gda.addElement(dEl1, "center");
        var dFilterEl = gda.addElementWithId(dElCenter,"div",dEl.id+dc.utils.uniqueId());
		dFilterEl.setAttribute("class","filtered");
    if (cname === "Urgency" && gda.utils.fieldExists(urgencyColors)) {
        ftChart.colors(urgencyColors);
    }
    else if (cname === "Escalation_Origin" && gda.utils.fieldExists(originColors)) {
        ftChart.colors(originColors);
    }
    else if (cname === "Escalation_Status" && gda.utils.fieldExists(statusColors)) {
        ftChart.colors(statusColors);
    }
    else if (cname === "Escalation_Max_Status" && gda.utils.fieldExists(statusColors)) {
        ftChart.colors(statusColors);
    }
    chtObj.filterEl = dFilterEl;
    return ftChart;
}

// above are the 'selector' charts/support
// below are the 'informational display' charts/support

gda.newChart = function(cf, cTitle, cnameArray, sChtGroup, chartType, chartOverrides) {
    console.log("gda nC: add '" + cTitle + "' " + chartType + " [" + cnameArray + "] overrides: " + JSON.stringify(chartOverrides));

    var iChart = newBaseChart(cf, cnameArray, sChtGroup, chartType);
    gda.charts[iChart].Title = cTitle;
    if (chartOverrides) { // test 8/10/2014 
		gda.charts[iChart].overrides = chartOverrides;	// reference for editing, might rethink and keep at slide level
        _.each(chartOverrides, function(value, key) {
            gda.charts[iChart][key] = value;
        });
	}

    var fn = 'new'+chartType+'Chart';        // function name template
    if (gda)
        gda[fn](iChart, cf);

    return iChart;
}

function newBaseChart(cf, cnameArray, sChtGroup, chartType) {
    var chtObj = new Object();
    chtObj.cnameArray = cnameArray; // one per 'series' in the chart, often just 1 or 2.
                                    // establishes the dimensionality or series size of the chart
    chtObj.chartType = chartType;
    chtObj.cf = cf;
    chtObj.sChartGroup = sChtGroup;
    chtObj.dDims = []; // one per 'series' in the chart, often just 1 or 2.
    chtObj.dGrps = []; // one per 'series' in the chart, often just 1 or 2.
    chtObj.wChart = 400;    // reasonable default. Can override.
    chtObj.hChart = 400;
    chtObj.bChooseable = true;
    chtObj.numberFormat = gda.numberFormat;
    var i = gda.charts.length;  // switch to dc.utils.uniqueId();
    gda.charts.push( chtObj );
    return i;
}

gda.newHistChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    if (!chtObj.nBins) chtObj.nBins = chtObj.wChart/20; // magic number
    gda.addOverride(chtObj,"elasticX",false);
    gda.addOverride(chtObj,"legend",false);

    var xDimension = gda.dimensionByCol(chtObj.cnameArray[0],chtObj.cf);

    var xhDimension = chtObj.cf.dimension(function(d) {
    var xmin = xDimension.bottom(1)[0][chtObj.cnameArray[0]];
    if (!xDimension.isDate)
    {
        if (isNaN(xmin)) xmin = 0;
    }
    var xmax = xDimension.top   (1)[0][chtObj.cnameArray[0]];
    var xbins = chtObj.wChart/10;
    var bExact = false;
    if (Math.round(xmax)==xmax && Math.round(xmin)==xmin) {
        var pbins = 1+Math.round(xmax-xmin);
        if (pbins<xbins)
            xbins = pbins;
        chtObj.nBins = xbins;
        bExact = true;
    }
    var v = (isNaN(+d[chtObj.cnameArray[0]]))?0.0:+d[chtObj.cnameArray[0]];
    return v;
     });
    chtObj.dDims.push(xhDimension);
    var dHistXGrp = xhDimension.group().reduceCount();
    chtObj.dGrps.push(dHistXGrp);
}

gda.newYHistChart = function(iChart, cf) {
    gda.newHistChart(iChart,cf); // similar to X, but rotated during display
    gda.charts[iChart].bChooseable = false; // YHist never...
}

gda.isDate = function (cname) {
    var bRet = false; // need more sophisticated method, breaks ServiceInst. 
    if (cname.indexOf("date")>=0 || cname.indexOf("Date")>=0 || cname.indexOf("Year")>=0 || cname.indexOf("Quarter")>=0 || cname.indexOf("Month")>=0 || cname.indexOf("Week")>=0 || cname.indexOf("Day")===0 || cname.indexOf("Start")>=0 || cname.indexOf("_Complete")>=0 || cname==="dd") {
        bRet = true;
    }
    return bRet;
}

// start with one dimension, then expand to several (paired/triples/etc bars, or stacked).
gda.newLineChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    gda.addOverride(chtObj,"interpolate",false);
    if (chtObj.cnameArray.length>1) {
        gda.addOverride(chtObj,"nFixed",null);	// field, but don't use.
                                
        var xDimension = gda.dimensionByCol(chtObj.cnameArray[0],chtObj.cf, true, chtObj.overrides["nFixed"]);
        if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;
        var yDimension = gda.dimensionByCol(chtObj.cnameArray[1],chtObj.cf,true);
        chtObj.dDims.push(xDimension);
        chtObj.dDims.push(yDimension);
    var dXGrp;
    if (!xDimension.isDate)
        dXGrp = xDimension.group();//.reduceCount(); // had been yD
    else
     //   dXGrp = xDimension.group().reduceCount(); // fix elasticX date?
        dXGrp = xDimension.group().reduceSum(function(d) {
            return +d[chtObj.cnameArray[1]]; });//Count();  // 

    chtObj.dGrps.push(dXGrp);
    chtObj.lineDimension = chtObj.cf.dimension(function(d) {
        return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]]; 
    });
    chtObj.lineGroup = chtObj.lineDimension.group().reduceSum(function(d) {
            return +d[chtObj.cnameArray[1]]; });

//    chtObj.wChart = 800;
//    chtObj.hChart = 200;
    }
}

gda.newBubbleChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];

    // would also like to add: d.month = d3.time.month(d.dd); 
    // should factor out dDims to allow date specification, poss in dataSource

    if (chtObj.cnameArray.length>0) {	// for now, 0
        var xDimension = gda.dimensionByCol(
                                //chtObj.overrides["timefield"],
                                chtObj.cnameArray[0],
                                chtObj.cf);
          if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;
        chtObj.dDims.push(xDimension);
	var dXGrp = xDimension.group().reduce(
                function (p, v) {
                    p.amountRaised += +v[chtObj.cnameArray[1]];//"Raised"];
                    p.deals += +v[chtObj.cnameArray[2]];//"Deals"];
                    return p;
                },
                function (p, v) {
                    p.amountRaised -= +v[chtObj.cnameArray[1]];//"Raised"];
                    if (p.amountRaised < 0.001) p.amountRaised = 0; // do some clean up
                    p.deals -= +v[chtObj.cnameArray[2]];//"Deals"];
                    return p;
                },
                function () {
                    return {amountRaised: 0, deals: 0}
                }
        );
	
        chtObj.dGrps.push(dXGrp); 
    }
}

gda.newTimelineChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];

    // should factor out dDims to allow date specification, poss in dataSource

    if (chtObj.cnameArray.length>1) {
        var xDimension = null;
        var dXGrp = null;
        if (gda.isDate(chtObj.cnameArray[0])) {
        gda.addOverride(chtObj,"timefield","Month");
        //gda.addOverride(chtObj,"reportingresolution","month");
        gda.addOverride(chtObj,"axisresolution","months");

            xDimension = gda.dimensionByCol(
                                chtObj.overrides["timefield"],
                                //chtObj.cnameArray[0],
                                chtObj.cf);
            xDimension.isDate = true;
            dXGrp = xDimension.group().reduceCount();//function (d) {
            //return d3.time.month(d[chtObj.cnameArray[0]]);
//            return d[chtObj.cnameArray[1]];  // + ?
            //});
        } else {
            xDimension = gda.dimensionByCol(
                                    chtObj.cnameArray[0],
                                    chtObj.cf);
            dXGrp = xDimension.group();//.reduceCount();
        }
        chtObj.dDims.push(xDimension);
        chtObj.dGrps.push(dXGrp); 
    }
}

gda.newSeriesChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    if (chtObj.cnameArray.length>1) {
        chtObj.seriesDimension = chtObj.cf.dimension(function(d) { return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]]; });
        chtObj.seriesGroup = chtObj.seriesDimension.group().reduceSum(function(d) { return +d[chtObj.cnameArray[1]]; });
    }
    //var xDimension = gda.dimensionByCol(chtObj.cnameArray[0], chtObj.cf);
    _.each(chtObj.cnameArray, function(cname,i) {
        var xDimension = gda.dimensionByCol(cname,chtObj.cf);
        chtObj.dDims.push(xDimension);
        var dXGrp = xDimension.group().reduceCount();
        chtObj.dGrps.push(dXGrp);
    });
}

gda.newBarChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    gda.addOverride(chtObj,"legend",false);
    var xDimension = gda.dimensionByCol(chtObj.cnameArray[0],chtObj.cf);
    chtObj.dDims.push(xDimension);
    var dXGrp = xDimension.group();
    chtObj.dGrps.push(dXGrp);
}

gda.newParetoChart = function(iChart, cf) {
    gda.newBarChart(iChart,cf);
    // add dim for percentage
}

gda.newRowChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"ignoreZeroValue",false);
    gda.addOverride(chtObj,"ignoreValuesBelow",1);
    gda.addOverride(chtObj,"ignoreKey","");
    var xDimension = gda.dimensionByCol(chtObj.cnameArray[0],chtObj.cf);
    chtObj.dDims.push(xDimension);
    var dXGrp = xDimension.group();//.top(5);// parameterize, allow adjusting n
    chtObj.dGrps.push(dXGrp);
}

gda.newChoroplethChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    if (chtObj.cnameArray.length>1)
    {
    gda.addOverride(chtObj,"legend",false);
    var xDimension = gda.dimensionByCol(chtObj.cnameArray[1],chtObj.cf);	// 1, State, is the accessor
    chtObj.dDims.push(xDimension);	// reduceCount
    var dXGrp = xDimension.group().reduceSum(function (d) { // or reduceCount(); if column not a numerical value
        return d[chtObj.cnameArray[0]];	// swapped 0 and 1, this is the value to chart
    });
    chtObj.dGrps.push(dXGrp);
    gda.addOverride(chtObj,"GeoJSON","");//../JSON_Samples/geo_us-states.json";	// need a JSON viewer/selector
    gda.addOverride(chtObj,"GeoJSON_Property_Accessor","");

    _.each(_.rest(chtObj.cnameArray,1), function(sCname) {
        gda.addOverride(chtObj,sCname,"");
    });
    }
}

// break this up into a hist/barchart function
// and the scatterplot function
// and eventually add a reference to the statistics display in the quad 4th.
gda.newStatsChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    var cnameArray = chtObj.cnameArray;
    if (cnameArray.length>0) {
        gda.addOverride(chtObj,"format",".2s");
        gda.addOverride(chtObj,"sigma","3");

        var xDimension = gda.dimensionByCol(cnameArray[0],chtObj.cf,true);
        gda.charts[iChart].dDims.push(xDimension);

        //if (gda.isDate(chtObj.cnameArray[0]))
        //    xDimension.isDate = true;

    // scatterplot dim/grp
    if (cnameArray.length>1)    // if 2nd attribute selected, use it for a dimension, for multiple stats sets
        chtObj.statsDimension = chtObj.cf.dimension(function(d)
                //{ return cnameArray[1]; });
                { return +d[cnameArray[1]]; });
    else
        chtObj.statsDimension = chtObj.cf.dimension(function(d)
                { return cnameArray[0]; }); // aggregates filtered population
                //{ return +d[cnameArray[0]]; });   // by unique value 'keys' (values of cnameArray[0] in d[].
    chtObj.statsGroup = chtObj.statsDimension.group();//.reduce();
    var reducer;
    reducer = reductio()
                .count(true)
                .sum(function(d)
                        { return +d[cnameArray[0]]; })
                .avg(function(d)
                        { return +d[cnameArray[0]]; })
                .std(function(d)
                        { return +d[cnameArray[0]]; })
                .max(function(d)
                        { return +d[cnameArray[0]]; })
                .min(function(d)
                        { return +d[cnameArray[0]]; })
                ;
    chtObj.reducer = reducer;
    reducer(chtObj.statsGroup);
    }
}

// optional regression
// https://groups.google.com/forum/#!topic/dc-js-user-group/HaQMegKa_U0
// http://forio.com/contour/gallery.html#/chart/scatter/scatter-trendline
gda.newScatterChart = function(iChart, cf) {
    var chtObj=gda.charts[iChart];
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"elasticX",false);
    gda.addOverride(chtObj,"elasticY",false);
    gda.addOverride(chtObj,"brushOn",true);
    gda.addOverride(chtObj,"mouseZoomable",true);
    if (chtObj.cnameArray.length>1) {
        var xDimension = gda.dimensionByCol(chtObj.cnameArray[0],chtObj.cf,true);
        var yDimension = gda.dimensionByCol(chtObj.cnameArray[1],chtObj.cf,true);
        gda.charts[iChart].dDims.push(xDimension);
        gda.charts[iChart].dDims.push(yDimension);

        if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;

    // scatterplot dim/grp
    chtObj.scatterDimension = chtObj.cf.dimension(function(d) { return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]]; });
    chtObj.scatterGroup = chtObj.scatterDimension.group().reduceSum(function(d) { return +d[chtObj.cnameArray[1]]; });
    }
}

// eventually add a statistics display in the 4th quad.
gda.newScatterHistChart = function(iChart, cf) {
    // these dims/grps are just for the hist section
    // refactor this out into the sub, later
    // and use a replacement container for (scatter,histX,histY,stats)
    var chtObj=gda.charts[iChart];
    if (chtObj.cnameArray.length>1) {

    var nBins = chtObj.wChart/20;// magic number
    if (!chtObj.nBins)
        chtObj.nBins = nBins;

    var iXChart = newBaseChart(cf, chtObj.cnameArray[0], chtObj.sChartGroup, "Hist");
    var iYChart = newBaseChart(cf, chtObj.cnameArray[1], chtObj.sChartGroup, "YHist");
    var iXStats = newBaseChart(cf, chtObj.cnameArray[0], chtObj.sChartGroup, "Stats");  // could do this for additional values
    var iYStats = newBaseChart(cf, chtObj.cnameArray[1], chtObj.sChartGroup, "Stats");
    gda.charts[iXChart].bChooseable = false;    // no sub charts
    gda.charts[iYChart].bChooseable = false;    // no sub charts
    gda.charts[iXStats].bChooseable = false;    // no sub charts
    gda.charts[iYStats].bChooseable = false;    // no sub charts
    gda.charts[iChart].iXChart = iXChart;
    gda.charts[iChart].iYChart = iYChart;
    gda.charts[iChart].iXStats = iXStats;
    gda.charts[iChart].iYStats = iYStats;
    gda.charts[iXChart].cnameArray = [chtObj.cnameArray[0]];        // duplicative
    gda.charts[iYChart].cnameArray = [chtObj.cnameArray[1]];
    gda.charts[iXStats].cnameArray = [chtObj.cnameArray[0]];
    gda.charts[iYStats].cnameArray = [chtObj.cnameArray[1]];
    gda.charts[iXChart].wChart = chtObj.wChart;                     
    gda.charts[iXChart].hChart = chtObj.hChart*3/4; // tuned
    gda.charts[iXChart].nBins = chtObj.nBins;
    gda.charts[iYChart].wChart = chtObj.hChart;
    gda.charts[iYChart].hChart = chtObj.wChart*3/4;
    gda.charts[iYChart].nBins = chtObj.nBins;

    gda.newHistChart(iXChart, cf);
    gda.newYHistChart(iYChart, cf);
    gda.newStatsChart(iXStats, cf);
    gda.newStatsChart(iYStats, cf);

    gda.newScatterChart(iChart, cf);
    }
}

// view element creators
// adds new dc scatterPlot, twin hists,  under dElIdBase div
gda.addDisplayCharts = function(docEl,sChtGroup, callback) { //, dElIdBase) {
    var bSomeAdded = false;
    _.each(gda.charts, function(chtObj,i) {
        if (chtObj.sChartGroup === sChtGroup) {
            //console.log("gda aDC: i col grp " + i + " " + chtObj.sChartGroup + " " + chtObj.chartType + " " + chtObj.cnameArray + " @el " + docEl.id + " cb? " + callback!==null);
            gda.addDisplayChart(docEl, i, callback);
            bSomeAdded = true;
        }
    });
    if (bSomeAdded) {
		console.log("renderALL gda.addDisplayCharts");
	   	dc.renderAll(sChtGroup);
	}
}

// non-public
gda.addDisplayChart = function(docEl, iChart, callback) {

  var chtObj = gda.charts[iChart];
  if (chtObj.bChooseable === true) {

    var dTb = docEl;
    var dTr = docEl;
    var dTd = docEl;

    if (gda._anchorEdit) {
        dTb = gda.addElement(docEl,"table");
            dTr = gda.addElement(dTb,"tr");
                dTd = gda.addElement(dTr,"td");
    }

    //addDCdiv(dTd, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
                  var dStr = gda.addElement(dTd,"h3");
                    var dTitleEl = gda.addElementWithId(dStr,"div",docEl.id+dc.utils.uniqueId());
                    chtObj.titleEl = dTitleEl;
		//			var dTxtT = gda.addTextNode(chtObj.titleEl,chtObj.Title);
                var dFilterEl = gda.addElementWithId(dTd,"div",docEl.id+dc.utils.uniqueId());
				//var dElCenter = gda.addElement(dFilterEl, "center");
                chtObj.filterEl = dFilterEl;
				//dFilterEl.setAttribute("class","filtered")
                var doChartEl = gda.addElementWithId(dTd,"div",docEl.id+dc.utils.uniqueId()); // might need to use chart title instead of uniqueId, to support 'closing' the edit.
                //console.log("gda aDC: _id " + doChartEl.id + " i " + iChart );

    var bAddedChart = gda.newDisplayDispatch(iChart, chtObj.chartType, doChartEl);
    if (bAddedChart) {
        if (gda.allowEdit() && callback && chtObj.bChooseable === true)
            gda.addRadioB(doChartEl, chtObj.chartType, gda.chart(chtObj).__dc_flag__, chtObj.chartType, chtObj.chartType, false, callback);
            gda.addElementWithId(doChartEl,"span",doChartEl.id+"controls");
            //gda.addRadioB(doChartEl, chtObj.chartType, gda.chart(chtObj).__dc_flag__, "Remove", chtObj.chartType, false, function() {// remove chart });
    }
  }
}

gda.newDisplayDispatch = function(i, chartType, docEl) {
    var fn = 'new'+chartType+'Display';        // function name template
    if (gda.charts[i].bChooseable)
        return gda[fn](i, docEl);
    return false;
}

// start with one dimension, expand to more later
gda.newLineDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>1) {
        var cnameArray = chtObj.cnameArray;
        var cname = "";
        _.each(cnameArray, function(sCname) {
            cname = cname + ((cname.length>0) ? "," : "") + sCname;
        });

        //reverted? 10/3/2014. why?
        //var dElP = dEl;//gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        //console.log("gda nLD: _id " + dElP.id + " i " + iChart );
        
		addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
        //addDCdiv(dElP, "charts", iChart, cname, chtObj.sChartGroup);   // add the DC div etc
        gda.charts[iChart].dElid = dElP.id;

        var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
        if (!dDims[0].isDate)
        {
            if (isNaN(xmin)) xmin = 0;
        }
        var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];
        var ymin = dDims[1].bottom(1)[0][chtObj.cnameArray[1]];
        if (isNaN(ymin)) ymin = 0;
        var ymax = dDims[1].top   (1)[0][chtObj.cnameArray[1]];

        var xs = d3.scale.ordinal();
        var xu = dc.units.ordinal();
        var cd = chtObj.lineDimension;
        var gr = chtObj.lineGroup;
        if (dDims[0].isDate) {
            xs = d3.time.scale().domain([xmin,xmax]);
            xu = d3.time.days;
            cd = chtObj.dDims[0];
            gr = chtObj.dGrps[0];
        }

        //console.log("add line for Line @ " + chtObj.dElid);
        var ftX = dc.lineChart("#"+chtObj.dElid,chtObj.sChartGroup)
        chtObj.chart = ftX;        // for now. hold ref
        ftX.gdca_chart = chtObj;
        ftX
            .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
            .width(chtObj.wChart)    // same as scatterChart
            .height(chtObj.hChart)
        .dimension(cd)
        .group(gr)
      //                      .valueAccessor(function(d){
      //                                      return d.value;
      //                                  })
            .x(xs)
            .xUnits(xu)
            //.y(d3.scale.linear().domain([ymin,ymax]))
            .elasticX(false)    // so it can be focused by another chart. Should be conditional on another chart attached?
            .elasticY(true)
            .brushOn(false);
        if (chtObj.overrides["interpolate"])
            ftX
                .interpolate(chtObj.overrides["interpolate"]);
        if (dDims[0].isDate)
        //ftX
        //  .round(d3.time.month.round);
        //  .xAxisLabel(chtObj.cnameArray[0])
        //ftX .xAxis().ticks(d3.time.months,1);
            //.title("")
        if (!dDims[0].isDate) {
        ftX
            .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" <= "+chtObj.numberFormat(xmax))
            .yAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[1] +" <= "+chtObj.numberFormat(ymax));
        }
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}

gda.newBubbleDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {	// need cnamearray test > 2
    var cnameArray = chtObj.cnameArray;
    var cname = "";
    _.each(cnameArray, function(sCname,i) {
        if (i>0)
        cname = cname + ((cname.length>0) ? "," : "") + sCname;
    });

    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin)) xmin = 0;
    }
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nSD: _id " + dElP.id + " i " + iChart );
    
    addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, cname, chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    var xs = d3.scale.ordinal();
    var xu = dc.units.ordinal();
    //var xu = dc.units.integers;
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain([xmin,xmax]);
        xu = d3.time.days;  // configurable, or automatic based on xmax-xmin?
    }

    //console.log("add series for Series @ " + chtObj.dElid);
    var ftX = dc.bubbleChart("#"+chtObj.dElid,chtObj.sChartGroup)
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
	.margins({top: 10, right: 50, bottom: 30, left: 60})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)
   //   .x(xs.domain([xmin,xmax]))
   //   .xUnits(xu)
     // .x(d3.scale.linear().domain([xmin,xmax]))
     // .x(d3.scale.ordinal().domain([xmin,xmax]))
     // .xUnits(dc.units.ordinal)
   //   .seriesAccessor(function(d) {
   //           return d.value; })
   //   .keyAccessor(function(d) {
   //           return d.key; })
     // .renderHorizontalGridLines(true)
     // .renderVerticalGridLines(true)
        .dimension(dDims[0])
        .group(chtObj.dGrps[0])
	.colors(d3.scale.category10())
	.keyAccessor(function (p) {
	    return p.value["amountRaised"];
	})
	.valueAccessor(function (p) {
	    return p.value["deals"];
	})
	.radiusValueAccessor(function (p) {
	    return p.value["amountRaised"];
	})
	.x(d3.scale.linear().domain([0, 5000]))
	.r(d3.scale.linear().domain([0, 4000]))
	.minRadiusWithLabel(15)
	.elasticY(true)
	.yAxisPadding(100)
	.elasticX(true)
	.xAxisPadding(200)
	.maxBubbleRelativeSize(0.07)
	.renderHorizontalGridLines(true)
	.renderVerticalGridLines(true)
	.renderLabel(true)
	.renderTitle(true)
	.title(function (p) {
	    return p.key
		    + "\n"
		    + "Amount Raised: " + gda.numberFormat(p.value["amountRaised"]) + "M\n"
		    + "Number of Deals: " + gda.numberFormat(p.value["deals"]);
	});
    ftX
	.yAxis().tickFormat(function (s) {
	    return s + " deals";
	});
    ftX
	.xAxis().tickFormat(function (s) {
	    return s + "M";
	});
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}


gda.newTimelineDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nMD: _id " + dElP.id + " i " + iChart );
    
	addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
   // addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    var v0 = null;
    var xmin = null;
    var xmax = null;

    if (!dDims[0].isDate)
    {
        v0 = chtObj.overrides[chtObj.cnameArray[0]];
        xmin = dDims[0].bottom(1)[0][v0];
        xmax = dDims[0].top   (1)[0][v0];
        if (isNaN(xmin)) xmin = 0;
        if (isNaN(xmax)) xmax = 0;
    } else
    {
        v0 = chtObj.overrides["timefield"];
        xmin = dDims[0].bottom(1)[0][v0];
        xmax = dDims[0].top   (1)[0][v0];
        if (xmin === undefined) xmin = new Date();
        if (xmax === undefined) {
            var Now = new Date();
            xmax = new Date(Now.getFullYear()+1,0,1);  //next year
        }
    }

    var xu = dc.units.ordinal();
    var xe = null;  // default
    var xs = d3.scale.ordinal();
    if (dDims[0].isDate) {
        xe = d3.time.month;
        if (chtObj.overrides["timefield"]) {
            var p = "month";//chtObj.overrides["reportingresolution"];
            var tInc = gda["T"+p+"IncMsecs"];   // time increment to assure max!=min, and max is past all data (.month only covers to first day of month by default)
                                                // this is to mask a brushing deficiency? brushing limit compare should use .month, but it appears to compare d.date to xmax.month (indirectly), instead of d.date.month
                                                // should a keyAccessor be supplied instead?
                                                // .round is used, so ...
            var d = xmax;//new Date(xmax);
            var t = d.getTime();
            t = t + tInc;
            xmax = new Date(t);
            //xmax.setTime(t);
            xe = d3.time[p];
            xmin = xe.floor(xmin); //.month.floor(xmin);
            xmax = xe.ceil(xmax);  //.month.ceil(xmax);
            var r = chtObj.overrides["axisresolution"];
        xu = d3.time[r]; //.months
        } else {
            xu = d3.time.months;
            xe = d3.time.month;
            xmin = xe.floor(xmin);
            xmax = xe.ceil(xmax);
        }
        xs = d3.time.scale().domain([xmin,xmax]);
        console.log("time scale " + xmin + " to " + xmax);
    }
    else {
        xs = d3.time.scale().domain([xmin,xmax]);
    }

    //console.log("add bar for Timeline @ " + chtObj.dElid);
    var ftX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup)
    ftX.stdMarginBottom = ftX.margins().bottom;
    ftX.margins().bottom = ftX.stdMarginBottom + 30;    // temp workaround.
    // setting that in the renderlet is 'too late' ? not working.

    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)
        .height(chtObj.hChart)
        .dimension(dDims[0])
        .group(chtObj.dGrps[0]);
    ftX
        .centerBar(true)
        .gap(30)
        .x(xs)//.nice())
        .xUnits(xu)
        .elasticX(true)
        .elasticY(true)
        //.valueAccessor(function(d){
                        //return d.value;
                    //})
        //.keyAccessor(function(d) {
        //    var m = d.key;
        //    m.setMilliseconds(0);
        //    m.setSeconds(0);
        //    m.setMinutes(0);
        //    m.setHours(0);
        //    m.setDate(0); // setDays
        //    //.get(as)Month();   // this pays a speed penalty. Prefer to just bump up the max by 1 unit.
        //                        // harder to generalize resolution too
        //    return m;  // build from chosen override, hardwired for test
        //})
        ;
    //if (dDims[0].isDate)
    {
     //   var dR = (xmax-xmin)/1000/60/60/24;
     //   if (dR>95) 
        {
          if (dDims[0].isDate) {
              ftX
              .round(xe.round);
            }
          ftX .xAxis().ticks(xu,1);//d3.time.months,1);
        }
    }

    ftX // new 8/25/2014
        .renderlet(function(c) {
            //if (c.xAxis().ticks()>9)
            //var st=   
                c.svg().select('g').select('.axis.x').selectAll('.tick').select('text')
                    //;
//            c.margins().bottom = c.stdMarginBottom + 30;
// would like to _.each(st,...
// and measure the text length, find max, and set margin based on that,
// but the simple test case of .bottom= above doesn't work here.
            //st
                    .attr("dx", "-.8em")                    // -.8
                    .attr("dy", "-.50em")    // .35          // .15
                    .attr("transform", function(d) {        // -45
                            return "rotate(-90)";
                        })
                    .style("text-anchor", "end");
        })

// chart.gdca_toFilter needs to be set by user (via title) through 'Timeline' editing interface.
    // this and another chart. assume for now these two are 0,1 or 1,0
        if (gda.charts.length>1) {
            if (iChart<2) {  // temp workaround until GUI is available
                gda.charts[iChart].chart.gdca_toFilter = gda.charts[1-iChart];
            }
            ftX.renderlet(function (chart) {
                if (chart.gdca_toFilter) {
                console.log("period renderlet");
        // why was this being removed? ohloh ex https://www.google.com/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=renderlet%20select(%22g.y%22).style(%22display%22%2C%20%22none%22)
		//	    chart.select("g.y").style("display", "none");
			    chart.gdca_toFilter.chart.filter(chart.filter()); // need method to specify [0]
                                                // possibly dropdown of charts except this one
                                                // or all charts except this one and Selectors
                }
			})
			.on("filtered", function (chart) {
                if (chart.gdca_toFilter) {
                console.log("period trigger");
			    dc.events.trigger(function () {
                if (chart.gdca_toFilter.chart.focus) {
                    console.log("period triggered");
                    chart.gdca_toFilter.chart.focus(chart.filter());
                }
			    });
                }
            });
        }
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}

// start with one dimension, expand to more later
gda.newSeriesDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>1) {
    var cnameArray = chtObj.cnameArray;
    var cname = "";
    _.each(cnameArray, function(sCname,i) {
        if (i>0)
        cname = cname + ((cname.length>0) ? "," : "") + sCname;
    });

    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin)) xmin = 0;
    }
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nSD: _id " + dElP.id + " i " + iChart );
    
	addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, cname, chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    var xs = d3.scale.ordinal();
    var xu = dc.units.ordinal();
    //var xu = dc.units.integers;
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain([xmin,xmax]);
        xu = d3.time.days;  // configurable, or automatic based on xmax-xmin?
    }

    //console.log("add series for Series @ " + chtObj.dElid);
    var ftX = dc.seriesChart("#"+chtObj.dElid,chtObj.sChartGroup)
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)
 //     .elasticY(true)
 //     .elasticX(true)
        .x(xs.domain([xmin,xmax]))
        .xUnits(xu)
     // .x(d3.scale.linear().domain([xmin,xmax]))
     // .x(d3.scale.ordinal().domain([xmin,xmax]))
 //     .xUnits(dc.units.ordinal)
        .seriesAccessor(function(d) {
                return d.value; })
        .keyAccessor(function(d) {
                return d.key; })
 //     .renderHorizontalGridLines(true)
 //     .renderVerticalGridLines(true)
        .legend(dc.legend())
        .brushOn(false)
        .xAxisLabel(chtObj.cname)
        .dimension(dDims[0])
        .group(chtObj.dGrps[0]);
    if (chtObj.overrides["legend"])
        ftX
            .legend(dc.legend());

        return true;
    }
    return false;
}

// start with one dimension, expand to more later
gda.newBarDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nBD: _id " + dElP.id + " i " + iChart );
    
    addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    var dom = [];   // .all() is faster than .top(Infinity)
    var maxL = 0;
    chtObj.dGrps[0].top(Infinity).forEach(function(d) {
        dom[dom.length] = d.key;
        var l = d.key.length;
        if (l>maxL) maxL = l;
    });
    // assume about 5 pixels for font until can extract. Doesn't account for angle
    var botMi = maxL>0 ? (maxL-1)*5 : 0;

    //console.log("add bar for Bar @ " + chtObj.dElid);
    var ftX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup);
    ftX
        .margins({top: ftX.margins()["top"],
                right: ftX.margins()["right"],
                bottom: botMi + ftX.margins()["bottom"],
                left: ftX.margins()["left"]});

    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        //.elasticY(true)
        .x(d3.scale.ordinal().domain(dom))//[xmin,xmax]))//[xmin,xmax]))    // was linear
        .xUnits(dc.units.ordinal)
        .label(gda.utils.labelFunction)
        .title(gda.utils.titleFunction)
        //.elasticX(true)
        // brush is off, as scale needs to be corrected manually
        //.brushOn(false)
        .dimension(dDims[0])
//    .yAxisLabel("Samples per Bin")
    .xAxisLabel(chtObj.cnameArray[0])
//    .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(xmax))
        .renderlet(function(c) {
            if (c.xAxis().ticks()>9)
                c.svg().select('g').select('.axis.x').selectAll('.tick').select('text')
                    .attr("dx", "-.8em")                    // -.8
                    .attr("dy", "-.50em")    // .35          // .15
                    .attr("transform", function(d) {        // -45
                            return "rotate(-90)";
                        })
                    .style("text-anchor", "end");
        })
        .group(chtObj.dGrps[0]);
    if (chtObj.overrides["legend"])
        ftX
            .legend(dc.legend());

        return true;
    }
    return false;
}

// create a composite, starting with a bar chart, add the cumulative percentage
// this probably needs a specific DC implementation, to get the line and bar
// sample to 'synchronize'. best I have so far is the samples synchronized, but
// the 'line' drawn is in the original sample order (thus looks wrong).
gda.newParetoDisplay = function(iChart, dEl) {
    //gda.newBarDisplay(iChart, dEl); // set up the base chart, bars
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        //console.log("gda nBD: _id " + dElP.id + " i " + iChart );
    
		addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
        //addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
        gda.charts[iChart].dElid = dElP.id;

// dGrps[0] has a .all(), etc. prob want that.
    if (false) {
        var dim0lyPerformanceGroup = chtObj.dGrps[0].reduce(
            /* callback for when data is added to the current filter results */
            function (p, v) {
                ++p.count;
                var k = p.chtObj.cnameArray[0];
                var vk = v[k];
                if (! (p.total[""+vk]) ) p.total[""+vk] = 0;
                var tt = ++p.total[""+vk];
                p.pp = (100*tt/all.value());
                return p;
            },
            /* callback for when data is removed from the current filter results */
            function (p, v) {
                --p.count;
                var k = p.chtObj.cnameArray[0];
                var vk = v[k];
                if (! (p.total[""+vk]) ) p.total[""+vk] = 0;
                var tt = --p.total[""+vk];
                p.pp = (100*tt/all.value());
                return p;
            },
            /* initialize p */
            function () {
                return {count: 0, total: {}, pp: 0, chtObj: chtObj};
            }
        );
    }

        gda.pareto.domain(chtObj.dGrps[0]);
        var maxLkey = _.max(gda.pareto.getDomain(), function(key) { return key.length; });
        var maxL = maxLkey.length;
        // assume about 5 pixels for font until can extract. Doesn't account for angle
        var xAxisTickLabelAngle = -45;
        if (Math.abs(xAxisTickLabelAngle)<20) maxL = 0;  // apply for steeper angles
        var botMi = maxL>0 ? (maxL-1)*5 : 0;

        var composite = dc.compositeChart("#"+chtObj.dElid, chtObj.sChartGroup)     // need id here
        composite
        .margins({top: composite.margins()["top"],
                right: composite.margins()["right"],
                bottom: botMi + composite.margins()["bottom"],
                left: composite.margins()["left"]});
        chtObj.chart = composite;

        var bc = 
                     dc.barChart(composite)
                        .dimension(chtObj.dDims[0])
                        .centerBar(true)
                        .barPadding(0.1)    // without this there is bar overlap!
                        //.gap(5)    // no impact?
                        //.outerPadding(0.5)
                        .colors('blue')
                        //.label(gda.utils.labelFunction)
                        //.title(gda.utils.titleFunction)
                        .valueAccessor(function(d){
                                        return d.value;
                                    })
                        .group(gda.pareto.createTempOrderingGroup(), "Samples");//chtObj.dGrps[0], "Samples");

        // add composited cumulative percentage
        composite
            .width(chtObj.wChart)
            .height(chtObj.hChart)
            .x(d3.scale.ordinal().domain(gda.pareto.getDomain()))
            .xUnits(dc.units.ordinal)
            .label(gda.utils.labelFunction)
            .title(gda.utils.titleFunction)
            //.renderHorizontalGridLines(true)
            .compose([ //chtObj.chart,
                     bc,
                   dc.lineChart(composite)
                      //.ordering(gda.pareto.orderValue)
                      .dimension(chtObj.dDims[0])
                      .colors('red')
                 //   .label(gda.utils.labelFunction2)
                 //   .title(gda.utils.titleFunction2)
                        .useRightYAxis(true)
                      //.valueAccessor(function(d){
                      //                return d.pp;    // no .pp
                      //          })
                            //chtObj.dGrps[0], 
                      .group(gda.pareto.createTempOrderingGroupReversed(),"Cumulative %") // 1, 'reduce' to cum%/total.
                      //.group(dim0lyPerformanceGroup,"Cumulative %")
                      //.renderlet(function(c) { c.svg().select('g').attr("transform","translate(60,0)")})
                        .renderDataPoints({radius: 5, fillOpacity: 0.5, strokeOpacity: 0.8})
                    ])
                    // workaround, remove clip-path to avoid clipping line points.
                    .renderlet(function(chart) {
                            chart.svg().selectAll('.chart-body').attr('clip-path', null)
                            });
            //.render();  // removed 6/10/2014
        composite
            .rightYAxis().tickValues([0,25,50,75,100]);
        if (Math.abs(xAxisTickLabelAngle)>=20) {
        var leftShift = 8;//chtObj.wChart/20;   // a bit of magic. rough scaling. could be better with a multiplier and an offset
        composite
          //  .renderlet(function(c) {
          //      console.log("composite renderlet");
          //      c.selectAll("g.x text").attr('dx', "-"+leftShift);
          //  })
            .renderlet(function(c) {
                c.selectAll("g.x text")
                    //.attr("y", 0)
                    //.attr("x", 9)
                    .attr("dx", "-.2em")   // function of xAxisTickLabelAngle, and 'center'
                    .attr("dy", "-0.5em")    // .15 .35
                    .attr("transform", function(d) {
                            return "rotate("+xAxisTickLabelAngle+")";
                        })
                    .attr('dx', "-"+leftShift)
                    .style("text-anchor", "end");
            })
              ;
        }
        if (chtObj.overrides["legend"])
            composite
                .legend(dc.legend());
        return true;
    }
    return false;
}

gda.pareto = (function() {
    var pareto = {
    dom: [],
    topI: []
    };
    return {
        getDomain: function() {
            return pareto.dom;   // could pluck the key, but the work was already done
        },
        domain: function(grp) {
            var all = gda.cf.groupAll();


            var sum = 0;
                            // .all() is faster than .top(Infinity)
            pareto.topI = grp.top(Infinity);    // make selectable
            pareto.dom = [];
            pareto.topI.forEach(function(d) {
                pareto.dom[pareto.dom.length] = d.key;
                sum = sum + d.value;
                d.sum = sum;
                d.pp = 100*sum/all.value();
            });
        },
        createTempOrderingGroupReversed: function() {
            var grp = {
            all: function() {
                var g = [];
                pareto.topI.forEach(function(d,i) {
                    g.push({key:d.key, value:d.pp});
                });
                return g;
            }
            };
            return grp;
        },
        createTempOrderingGroup: function() {
            var grp = {
            all: function() {
                var g = [];
                pareto.topI.forEach(function(d,i) {
                    g.push({key:d.key, value:d.value});
                });
                return g;
            }
            };
            return grp;
        }
    };
return gda.pareto; })();

gda.newRowDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nBD: _id " + dElP.id + " i " + iChart );
    
	addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    //console.log("add row for Row @ " + chtObj.dElid);
    var ftX = dc.rowChart("#"+chtObj.dElid,chtObj.sChartGroup)
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .ignoreZeroValue(chtObj.overrides["ignoreZeroValue"], chtObj.overrides["ignoreValuesBelow"], chtObj.overrides["ignoreKey"] ) //true,2,"") 
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        //.x(d3.scale.ordinal().domain(dom))//[xmin,xmax]))//[xmin,xmax]))    // was linear
        //.cap(3)
        .elasticX(true)
        // brush is off, as scale needs to be corrected manually
        //.brushOn(false)
        .dimension(dDims[0])
//    .yAxisLabel("Samples per Bin")
//    .xAxisLabel(chtObj.cnameArray[0])
        .group(chtObj.dGrps[0]);
    ftX .xAxis().ticks(6);
    if (chtObj.Title === "Escalation Status" && gda.utils.fieldExists(statusColors)) {
        ftX.colors(statusColors);
    }
    else if (chtObj.Title === "Max Status" && gda.utils.fieldExists(statusColors)) {
        ftX.colors(statusColors);
    }
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}

gda.newChoroplethDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nCD: _id " + dElP.id + " i " + iChart );
    
	addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[1], chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;

    //console.log("add row for Row @ " + chtObj.dElid);
    var ftX = dc.geoChoroplethChart("#"+chtObj.dElid,chtObj.sChartGroup);
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX.width(chtObj.wChart)//  900) //chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)	//	500) //chtObj.hChart)        // not nearly as high
        .dimension(dDims[0]) //states) 
        .group(chtObj.dGrps[0]); //stateRaisedSum); 

	var p = gda.utils.fieldExists( chtObj.overrides.GeoJSON) ? chtObj.overrides.GeoJSON : null;	// might want to use '.privproperties.' instead
    if (p) {
    d3.json(p,
			//"../JSON_Samples/geo_us-states.json",
		   	function( statesJson) {
				if (statesJson) {
					console.log("GeoJSON loaded, " + statesJson);
					ftX.colors(d3.scale.quantize().range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
						.colorDomain([0, 200])
						.colorCalculator(function (d) { return d ? ftX.colors()(d) : '#555'; })
						.title(function (d) {
										//return "State: " + d.key + "\nTotal Amount Raised: " + gda.numberFormat(d.value ? d.value : 0) + "M";
										return chtObj.cnameArray[1]+": " + d.key + "\nTotal Amount "+chtObj.cnameArray[0]+": " + gda.numberFormat(d.value ? d.value : 0) + "M";
									}) ;
						//.on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
					_.each(_.rest(chtObj.cnameArray,1), function(sCname) {
					//var sCname = chtObj.cnameArray[1];
						ftX
							.overlayGeoJson(statesJson.features, sCname, function (d) { //"State", 
											//return d["properties"]["name"];
											return d[chtObj.overrides.GeoJSON_Property_Accessor][chtObj.overrides[sCname]];
										})
					});
					console.log("renderALL GeoJSON");
					dc.renderAll(sChartGroup);
				}
    });
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());
    return true;
    }
    }
    return false;
}

// Hist charts use dDim(s) so a "trendline" or fitted line or another variable can be displayed as well
// HistDisplay is a standard orientation histogram using a dc.barChart
gda.newHistDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;
    if (dDims.length>0) {
        var cnameArray = chtObj.cnameArray;                         // prob never used
        var cname = "";                                             // prob never used
        _.each(cnameArray, function(sCname) {                       // prob never used
            cname = cname + ((cname.length>0) ? "," : "") + sCname; // prob never used
        });
    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin)) xmin = 0;
    }
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

    {//if (!chtObj.dElid) { //}   // workaround until div creation vs layout resolved
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        //console.log("gda nHD: _id " + dElP.id + " i " + iChart );
        
		//addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
        addDCdiv(dElP, "charts", iChart, cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
        gda.charts[iChart].dElid = dElP.id;
    }


    //console.log("add bar for Hist @ " + chtObj.dElid);
    var ftHistX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup); //"#ftHistXEl",chtObj.sChartGroup);
    chtObj.chart = ftHistX;        // for now. hold ref
    ftHistX.gdca_chart = chtObj;
    ftHistX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        // ScatterHist needs to un-elasticY?
        .elasticX(chtObj.overrides["elasticX"])
        .elasticY(true)
        //.x(d3.scale.linear().domain([0,chtObj.nBins]))//.range([xmin,xmax])
        .x(d3.scale.linear().domain([xmin,xmax]))
// simplify the Hists since fp.precision exists
        .xUnits(dc.units.fp.precision((xmax-xmin)/chtObj.nBins))  // try alternative (already implemented) workaround for brush selecting right-most sample on a fp axis. Don't like it due to the 'unknown' precision where we're using arbitrary (csv) data.
        // brush is off, as scale needs to be corrected manually
        .brushOn(true)
        .centerBar(true)
        .dimension(dDims[0])
        //.barPadding(0.2)  // these two don't seem to work right in 2.0
        //.gap(10)
//    .yAxisLabel("Samples per Bin")
    .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(xmax))
    //.xAxisLabel(xmin+" => "+ chtObj.cnameArray[0] +" (binned) <= "+xmax)
        .group(chtObj.dGrps[0]);

        if (dDims[0].isDate)
            ftHistX .xAxis().ticks(d3.time.months,6);   // months should be a setting
        else
            ftHistX .xAxis().ticks(4);
        if (chtObj.overrides["legend"])
            ftHistX
                .legend(dc.legend());

if (false) {
    ftHistX.xUnits( function(start, end, xDomain) {
                        return Math.abs(end - start);
                    });
    var uF = ftHistX.xUnits();
    //console.log("xUnits " + uF(xmin, xmax) + " xmin " + xmin + " xmax " + xmax);

    ftHistX.xAxis().tickFormat( function(v,i) { 
                    var vm = (+xmax - +xmin) / uF(xmin, xmax);
                    var vr = ftHistX.xAxis().ticks() - 1;
                    var xr = ftHistX.xAxis().scale().range();
                    vr = vr / (xr[1]-xr[0]);
                    console.log("v " + +v + " i " + i + " vm " + vm + " sum " + (+xmin + (+v)*vm) );//-1 + 
                    return chtObj.numberFormat(+xmin + i*vr); });//-1 + 
}

        return true;
    }
    return false;
}

// YHistDisplay is a 90 degree CCW orientation histogram using a dc.barChart
gda.newYHistDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;
    if (dDims.length>0) {
    var ymin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (isNaN(ymin)) ymin = 0;
    var ymax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

    {//}if (!chtObj.dElid) {    // workaround until div creation vs layout resolved
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        //console.log("gda nYHD: _id " + dElP.id + " i " + iChart );
        
		//addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
        addDCdiv(dElP, "charts", iChart, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
        gda.charts[iChart].dElid = dElP.id;
    }


    //console.log("add bar for YHst @ " + chtObj.dElid);
    var ftHistY = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup);//"#ftHistYEl",chtObj.sChartGroup);
    chtObj.chart = ftHistY;        // for now. hold ref
    ftHistY.gdca_chart = chtObj;
    ftHistY
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(1.05*chtObj.wChart)        // adj, will be turned 90 degrees
        .height(chtObj.hChart)            // same as scatterChart
        .elasticY(true)
        // v== for rowChart
        //.y(d3.scale.linear().domain([0,chtObj.nBins+3]))//[ymin,ymax]))
        .x(d3.scale.linear().domain([ymin,ymax])) //[0,chtObj.nBins]))//[ymin,ymax]))
        // brush is off, as scale needs to be corrected manually
        //.brushOn(false)  // not in rowChart
        .brushOn(true)
        .centerBar(true)
        .dimension(dDims[0])//yDimension)
        //.useRightYAxis(true)
    //.yAxisLabel("Samples per Bin")    // not in
    .xAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(ymax))
        .group(chtObj.dGrps[0])
        .renderlet(function(c) {
          console.log("YHist renderlet");
          // rightAxis // c.svg().select('g').attr("transform","rotate(270," + (0.71*chtObj.hChart) + "," + (0.35*chtObj.wChart) + ")")  // ({//});//200,172
          c.svg().select('g').attr("transform","rotate(270," + (0.65*chtObj.hChart) + "," + (0.35*chtObj.wChart) + ")")});//200,172
    //ftHistY                                              +3
        //.fixedBarHeight( ftHistY.height() - (chtObj.nBins + 1) * ftHistY.gap() / (chtObj.nBins));
    ftHistY
        .xAxis().ticks(6);
        //.xAxis().ticks(d3.time.months,6);
        if (chtObj.overrides["legend"])
            ftHistY
                .legend(dc.legend());
        return true;
    }
    return false;
}

gda.newStatsDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (chtObj.cnameArray.length>0) {

    var sDcData = dEl.id+dc.utils.uniqueId();
    var dEl0 = gda.addElementWithId(dEl,"div",sDcData);

        var dTb = gda.addElement(dEl0,"table");
            var dTr = gda.addElement(dTb,"tr");
                var dTd = gda.addElement(dTr,"td");
                    var dStng = gda.addElement(dTd, "strong");
                    var dTxtT = gda.addTextNode(dStng,chtObj.Title ? chtObj.Title : chtObj.cnameArray[0] );
            var dTr = gda.addElement(dTb,"tr");
                var dTd = gda.addElement(dTr,"td");

                    var dEl1 = gda.addElement(dTd,"div");

                    dEl1.setAttribute("class","dc-"+sDcData+"-stats");
                    var dTb = gda.addElement(dEl1,"table");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","count-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," count ");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","mean-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," mean ");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","std-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," std ");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","max-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," max ");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","min-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," min ");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","pNsigma-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," +Nsigma ");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," Nsigma=");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","Nsigma-stat");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dSpan = gda.addElement(dTd,"span");
                                dSpan.setAttribute("class","mNsigma-stat");
                            var dTd = gda.addElement(dTr,"td");
                                var dTxtT = gda.addTextNode(dTd," -Nsigma ");

    gda.charts[iChart].dElid = dEl0.id;
    
    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin))
            xmin = 0;
        if (isNaN(xmax))
            xmax = 0;
    }
    var exFac = 0.01;    // expansion factor, relax ends so min/max points have some relief
    var xdomain = [xmin,xmax];

    var xs = d3.scale.linear();
    var xu = dc.units.integers();
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain(xdomain);
        xu = d3.time.days;
    }
    else
    {
        xdomain = expandDomain(xdomain,exFac);
        xs.domain(xdomain);
    }

    //chtObj.chart = statsChart;
    //statsChart.gdca_chart = chtObj;
    //statsChart
    //.dimension(chtObj.statsDimension)
    //.group(chtObj.statsGroup);

    dc.dataStats(".dc-"+sDcData+"-stats", chtObj.sChartGroup)
    .dimension(chtObj.statsDimension)
    .group(chtObj.statsGroup)
    .formatNumber(d3.format(chtObj.overrides["format"]))
    .sigma(chtObj.overrides["sigma"]);

    // if cnameArray.length>1, [1] is "key", use table display?

        return true;
    }
    return false;
};

gda.newScatterDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];
    var dDims = chtObj.dDims;

    if (chtObj.cnameArray.length>1) {

    var cnameArray = chtObj.cnameArray;
    var cname = "";
    _.each(cnameArray, function(sCname) {
        cname = cname + ((cname.length>0) ? "," : "") + sCname;
    });

    var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
    //console.log("gda nSD: _id " + dElP.id + " i " + iChart );

	addDCdiv(dElP, "charts", iChart, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
    //addDCdiv(dElP, "charts", iChart, cname, chtObj.sChartGroup);   // add the DC div etc
    gda.charts[iChart].dElid = dElP.id;
    
    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin))
            xmin = 0;
    }
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];
    var ymin = dDims[1].bottom(1)[0][chtObj.cnameArray[1]];
    if (isNaN(ymin))
        ymin = 0;
    var ymax = dDims[1].top   (1)[0][chtObj.cnameArray[1]];
    var exFac = 0.01;    // expansion factor, relax ends so min/max points have some relief
    var xdomain = [xmin,xmax];
    var ydomain = [ymin,ymax];

    var xs = d3.scale.linear();
    var xu = dc.units.integers();
    //var xs = d3.scale.ordinal();
    //var xu = dc.units.ordinal();
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain(xdomain);
        xu = d3.time.days;
    }
    else
    {
        xdomain = expandDomain(xdomain,exFac);
        ydomain = expandDomain(ydomain,exFac);
        xs.domain(xdomain); // was d3.scale.linear().domain(xdomain))//.nice())
    }

// load chart setups

    // need to 'create' the div
    //console.log("add scatter @ " + dElP.id);
    var scatterChart = dc.scatterPlot("#"+dElP.id, chtObj.sChartGroup );
    //var scatterChart = dc.bubbleChart("#"+dElP.id, chtObj.sChartGroup );
    chtObj.chart = scatterChart;
    scatterChart.gdca_chart = chtObj;
    scatterChart
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .elasticX(chtObj.overrides["elasticX"])
        .elasticY(chtObj.overrides["elasticY"])
    .width(chtObj.wChart)
    .height(chtObj.hChart)
    //.mouseZoomable(true)        // . not working in display in Y?
    .mouseZoomable(chtObj.overrides["mouseZoomable"])
    .x(xs)
    .xUnits(xu)
    .y(d3.scale.linear().domain(ydomain))//.nice()) // to use nice, need to adjust histograms
    .dimension(chtObj.scatterDimension)
    .group(chtObj.scatterGroup)
    .brushOn(chtObj.overrides["brushOn"])
    //.brushOn(true) // if set to false, chart can be 'zoomed', but looks like it needs elasticY then to update Y axis ticks properly. mouseZoomable.
    //.rangeChart(pnlPerDaybarChartBrush)
    //.xAxisPadding(0.11)        // fix ! hmm, percentage of full range
    //.yAxisPadding(0.11)
    .renderVerticalGridLines(true)
    .renderHorizontalGridLines(true)
    .yAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[1]  +" <= "+chtObj.numberFormat(ymax));
    var xLabelFormat = chtObj.numberFormat;
    if (dDims[0].isDate) {
        xLabelFormat = gda.dateFormat;
    scatterChart
        .xAxis().ticks(d3.time.months,6);
    }
    else {
//        scatterChart
//            .xAxis().ticks(6);
    }
    scatterChart
        .xAxisLabel(xLabelFormat(xmin)+" => "+ chtObj.cnameArray[0] +" <= "+xLabelFormat(xmax));
    //.label(function (p) { return p.key; }) //for bubbles, etc.
    //.xAxis().ticks(4).tickFormat(function (v) { return chtObj.numberFormat(v);})
        if (chtObj.overrides["legend"])
            scatterChart
                .legend(dc.legend());

        return true;
    }
    return false;
};

    function expandDomain(adomain, exCoef) {
        if (adomain.length===2) {
        var r = adomain[1]-adomain[0];
        var exV = r * exCoef;
        adomain[0] = +adomain[0] - exV;
        adomain[1] = +adomain[1] + exV;
    }
    return adomain;
    } 

gda.newScatterHistDisplay = function(iChart, dEl) {
    var chtObj=gda.charts[iChart];

    if (chtObj.cnameArray.length>1) {
    var iXChart = gda.charts[iChart].iXChart;
    var iYChart = gda.charts[iChart].iYChart;
    var iXStats = gda.charts[iChart].iXStats;
    var iYStats = gda.charts[iChart].iYStats;

    var dTb = gda.addElement(dEl,"table");
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newScatterDisplay(iChart, dTd);
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newYHistDisplay(iYChart, dTd);
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newHistDisplay(iXChart, dTd);
            var dTd = gda.addElement(dTr,"td");
                var dTb = gda.addElement(dTd,"table");
                    var dTr = gda.addElement(dTb,"tr");
                        var dTd = gda.addElement(dTr,"td");
                            dTd.id = dEl.id+dc.utils.uniqueId();
                            gda.newStatsDisplay(iXStats, dTd);
                        var dTd = gda.addElement(dTr,"td");
                            dTd.id = dEl.id+dc.utils.uniqueId();
                            gda.newStatsDisplay(iYStats, dTd);
                            //var dElS = document.createElement("div");
    
        return true;
    }
    return false;
};

// map a table to the html display
// might want to pass dimension in here, so multiple tables can see the same data differently (views) ?
// maybe push the column diffs here too? for same reason.
// for that matter the sChartGroup would also be needed.
// table-hover is from bootstrap
gda.newTableDisplay = function(dEl, iChart) {
    // need to construct the doc ids, and the table.
    var chtObj=gda.tables[iChart];
    var chartType = "tables";
    var sDcData = dEl.id+dc.utils.uniqueId();

    var dEl0 = gda.addElementWithId(dEl,"div",sDcData);

        var dEl1 = gda.addElement(dEl0,"div");
        dEl1.setAttribute("class","dc-"+sDcData+"-count");
            var dSpan = gda.addElement(dEl1,"span");
            dSpan.setAttribute("class","filter-count");
            var dTxtT = gda.addTextNode(dEl1," selected out of ");
            var dSpan = gda.addElement(dEl1,"span");
            dSpan.setAttribute("class","total-count");
            var dTxtT = gda.addTextNode(dEl1," records");

        var dTbl = gda.addElement(dEl0,"table");
        dTbl.setAttribute("class","table table-hover dc-"+sDcData+"-table"); // need to specialize this for each one

    //console.log("add table @ " + sDcData);//chtObj.dElid);

    dc.dataCount(".dc-"+sDcData+"-count", chtObj.sChartGroup)
    .dimension(chtObj.cf)
    .group(chtObj.cf.groupAll());

    console.log("cT: sorting by "); 
    (gda.myCols.csetupSortTableCols && gda.myCols.csetupSortTableCols.length>0) ? console.log(" col " + gda.myCols.csetupSortTableCols[0]) :console.log(" by date d.dd");
    //(chtObj.selCols && chtObj.selCols.csetupChartCols && chtObj.selCols.csetupChartCols.length>1) ? console.log("col " + chtObj.selCols.csetupChartCols[chtObj.selCols.csetupChartCols.length-1]) :console.log("by date d.dd");
    dc.dataTable(".dc-"+sDcData+"-table", chtObj.sChartGroup)
    // dDims[0] sets the table macro sort order. .sort specifies the order within groups
    .dimension(chtObj.dDims[0])//dateDim)        // cf2 might balk at null here
//  .group(gda.dateDimension)//function (d) { 4/21/13 new change but possibly broke tables // }
    .group(function (d) {
        var format = d3.format("02d");
        var r = 1;
        if (d && d.dd){
        //console.log("d.dd " + d.dd);
        r = d.dd.getFullYear() + "/" + format((d.dd.getMonth() + 1));
        }
        return r;
    })
    .size(500)  // arbitrary. make selectable
    .columns(chtObj.colAccessor)
    // sorts by available date first unless 2+ columns are chosen, then uses the last chosen, within the date grouper
    //.sortBy(function (d) { return (chtObj.selCols && chtObj.selCols.csetupChartCols && chtObj.selCols.csetupChartCols.length>1) ?+d[chtObj.selCols.csetupChartCols[chtObj.selCols.csetupChartCols.length-1]]:d.dd; })
    .sortBy(function (d) { return (gda.myCols.csetupSortTableCols && gda.myCols.csetupSortTableCols.length>0) ?+d[gda.myCols.csetupSortTableCols[0]]:d.dd; })
    .order(d3.descending);
  //  .sortValues(function(a,b) {
  //      return b - a;
  //    });
//    .renderlet(function (table) {
//        table.selectAll(".dc-table-group").classed("info", true);
//    });

//    dc.renderAll(sGroup);
}

// create a table object						note myCols is temporary. sorted by date unless myCols>=2 and uses [1].
                                                // remove sDCData Table,Count later
gda.createTable = function(cf, dateDim, columns, sChtGroup, bShowLinksInTable, bShowPicturesInTable, selCols) {
    var chtObj = new Object();
    chtObj.cnameArray = columns;        // one per 'series' in the chart, often just 1 or 2.
                                    // establishes the dimensionality or series size of the chart
    //chtObj.chartType = chartType; // not yet. just one table type
    chtObj.cf = cf;
    chtObj.sChartGroup = sChtGroup;
    chtObj.dDims = [dateDim]; // one per 'series' in the chart, often just 1 or 2.
    chtObj.numberFormat = gda.numberFormat; // default for unspecified columns
    chtObj.selCols = selCols;       // such as this one... ? need to design*1
// design*1 method to save 'choices' and have this reference that copy of 'choices'. Shared right now.
    var iTable = gda.tables.length;
    gda.tables.push( chtObj );

    console.log("cT: # " + iTable + " cols " + JSON.stringify(columns));

    chtObj.colAccessor = [];
    if (bShowLinksInTable || bShowPicturesInTable) { // only use if requested, overhead
    _.each(columns, function(name) {    // really only need for columns that might contain a link
        chtObj.colAccessor.push(
        [name,
        function(d) {
            if (bShowPicturesInTable && isPhoto(d[name]))
                return createPhoto(d[name]);
            else if (bShowLinksInTable && isHttp(d[name]))
            return createLink(d[name]);
            else
            return d[name];
        }]
        );
    });
    }
    else
	chtObj.colAccessor = columns;


    return iTable;

function createLink(d) {
    return '<a href=\"' + d + '\" target=\"_blank\">' + d + "</a>";
}
function createPhoto(d) {
    return '<img src=\"' + d + '\" alt=\"[ 404 ]\">';
}
}

gda.new_crossfilter = function() {
    gda.cf = crossfilter();     // for now, just replacing any previous
    //gda.cf.remove();    // empty the crossfilter  ?
    //if (gda.cf.size() > 0) {
//        dc.filterAll();
//        gda.cf.remove();
//        dc.renderAll();
    //}
};


//===================== HTML support functions
function isPhoto(d) {
    return (typeof(d)==="string" && 
           // (d.indexOf("http:")===0 || d.indexOf("https:")===0 || d.indexOf("file:")===0) && 
           ((d.indexOf(".jpg")>0 ) || (d.indexOf(".png")>0  ) || (d.indexOf(".bmp")>0)  ));
}
function isHttp(d) {
    return (typeof(d)==="string" && (d.indexOf("mailto:")===0 || d.indexOf("http:")===0 || d.indexOf("https:")===0 || d.indexOf("file:")===0 || d.indexOf(".html")>0 ));
}

// note this needs further correction/improvement as the 'sChartGroup' is referring to a global; it should be a 'gda.chartGroup(sChtGroup)' lookup.

// note chartType refers to 'selectors' (aka Chart(dim)), 'charts' (aka Chart(results))
function addStatsdiv(dEl, chartType, i, cname, sChtGroup) {
    //create the equivalent of:
    //<div id="ftChartEl">
    // <center>
    //  <strong>A Filter</strong>
    //</div>

    var dCen = gda.addElement(dEl, "center");
        var dStng = gda.addElement(dCen, "strong");
            var dTxtT = gda.addTextNode(dStng,cname);
        var dEld = gda.addElementWithId(dCen,"div",dEl.id+"MyStats");
        var dTxtT = gda.addTextNode(dEld,"placeholder");    // temporary
}

function addDCdiv(dEl, chartType, i, cname, sChtGroup) {
    //create the equivalent of:
    //<div id="ftChartEl">
    // <center>
    //  <strong>A Filter</strong>
        //  <a class="reset" href="javascript:ftChart.filterAll(sChartGroup);dc.redrawAll(sChartGroup);" style="display: none;">reset</a>
        //  <div class="clearfix"></div>
    //</div>

    var dCen = gda.addElement(dEl, "center");
        var dStng = gda.addElement(dCen, "strong");
            var dTxtT = gda.addTextNode(dStng,cname);

    // from http://www.zmslabs.org/svn/zmslabs/ZMS/tags/2.10.3/dtml/object/manage_menu.dtml
        var dTxtT = gda.addTextNode(dCen," ");
        var dEla = gda.addElement(dCen,"a");
        //dEla.setAttribute("href","javascript:gda."+chartType+"["+i+"].chart.filterAll(sChartGroup);dc.redrawAll(sChartGroup);");
        dEla.setAttribute("href","javascript:gda."+chartType+"Reset("+i+",sChartGroup);");
        dEla.setAttribute("class","reset");
        dEla.setAttribute("style","display: none;");
        var dTxtT = gda.addTextNode(dEla,"reset");

        var dElb = gda.addElement(dCen,"div");
        dElb.setAttribute("class","clearfix");
        //dElb.class = "clearfix";
}

// essentially does 
// (0th pref) gda[fnname as string](args)
// (2nd pref) window["foo"](arg1, arg2);
// (3rd pref) eval(fname)(arg1, arg2);
// (1st pref:)
function executeFunctionByName(functionName, context /*, args */) {
    var args = Array.prototype.slice.call(arguments, 2);
    var namespaces = functionName.split(".");
    var func = namespaces.pop();
    for (var i = 0; i < namespaces.length; i++) {
        context = context[namespaces[i]];
    }
    return context[func].apply(context, args);
}


////////////////////////////////

// File Handling

gda.saveState = function (d,i) {

        console.log("saveState: d,i " + d + "," + i);
        var txt = gda.slideRegistry.asText();
        var win;
        var doc;
        win = window.open("", "WINDOWID");
        doc = win.document;
        doc.open("text/plain");
        doc.write("{");
        doc.write('"version": "' + gda.version + '",\n\n');
        doc.write('"minor": "' + gda.minor + '",\n\n');
        doc.write('"branch": "' + gda.branch + '",\n\n');
        doc.write('"help": "Manually Save: Right-Click, View Source, File/SaveAs name.csv",\n\n');
        doc.write('"slides" : ' + txt);
        doc.write("\n\n}");
      //doc.write("<pre>//Manually Save: Right-Click, View Source, File/SaveAs name.csv\n\nLine1,Field2,Field3\nLine2,Field2,Field3\n</pre>");
        doc.close();
    }

// 10/1/2014 Dashboard 'inclusion'.
// The below method could restore only the "bDashInclude" components into the view.
// Issue: 'filters' selection 'requires' a PieChart selector presently, when just the crossfilter.filter('filters') is needed. So giving the 'same' view of a chart requires the context. Have to separate the PieChart (or other Chart) filter selection from the chart(s) themselves.
// This would give a consistent view anywhere included.
// alternatively, the requester could provide the 'restore set'.
// The latter would allow the other viewer to choose.
// This is experimental. The 3rd way to do this is to just have the
// requester construct the desired view.
// Yet another option, store all charts in file each, and use multipart namespace for fields (dataob.field,
// or an indirection (a.b.c = dataob.field, and use a.b.c in a chart); then just include desired charts.
gda.restoreDashOnlyDeferred = function(error, oArray) {
    console.log("restoreDashOnlyDeferred e(" +
           (error ?
                (error.message ? 
                    error.message
                    :error.statusText)
                :"no error")+")");
    if (error || !oArray || oArray.length<1)  {
    }
    else
    {
    console.log("rDOD allDataLoaded in " + oArray[0]);
    gda.restoreStateFromObject(oArray[0], true);
    if (gda.deferredHash !== undefined && gda.deferredHash !== null) {
        // or perhaps in restoreStateFromObject?
        var lH = gda.deferredHash;
        console.log("deferred Hash " + lH);
        console.log("deferred Hash " + JSON.stringify(lH));
        gda.deferredHash = null;
        window.location.hash = lH;
    }
    }
};

gda.restoreStateDeferred = function(error, oArray) {
    console.log("restoreStateDeferred e(" +
           (error ?
                (error.message ? 
                    error.message
                    :error.statusText)
                :"no error")+")");
    if (error || !oArray || oArray.length<1)  {
    }
    else
    {
    console.log("rSD allDataLoaded in " + oArray[0]);
    gda.restoreStateFromObject(oArray[0], false);
    if (gda.deferredHash !== undefined && gda.deferredHash !== null) {
        // or perhaps in restoreStateFromObject?
        var lH = gda.deferredHash;
        console.log("deferred Hash " + lH);
        console.log("deferred Hash " + JSON.stringify(lH));
        gda.deferredHash = null;
        window.location.hash = lH;
    }
    }
};
gda.restoreStateFromObject = function(o, bDashOnly) {
    console.log("rSFO: bDO " + bDashOnly);
    if (o && o.slideRefs) {
        _.each(o.slideRefs, function(aSlideRef) {  
            if (!bDashOnly || (gda.utils.fieldExists(aSlideRef.bDashInclude) && aSlideRef.bDashInclude)) {
            var filepath = aSlideRef.dataprovider;
            if (!gda.utils.fieldExists(aSlideRef.bLocalFile)|| aSlideRef.bLocalFile)
            {
                    filepath = filepath + aSlideRef.datafile;
            }
            else
            {
                //filepath = filepath + aSlideRef.datafile;
            }
            gda.slideFileLoad(filepath, bDashOnly ? gda.restoreDashOnlyDeferred : gda.restoreStateDeferred);
            }
        });
    }
    if (o && o.slides) {
        var bAny = false;
        _.each(o.slides, function(aSlide) {    // just (key) if parseRows is used.
            //o.slide.bLoaded = false;
            // update o.slide to have the slide state defaults, where not set.
            var restoredSlide = jQuery.extend(true, gda.newSlideState(), aSlide);   // add any missing fields.
            if (!bDashOnly || (gda.utils.fieldExists(restoredSlide.bDashInclude) && restoredSlide.bDashInclude)) {
                bAny = true;
                gda.slides.append(gda.slide(restoredSlide));  // decorate 
            }
        });
        if (bAny)
            gda.view.show();
    }

};
gda.restoreState = function(text) {
    console.log("rS:");
    if (text) {
    gda.clearAllSlides();  // but currently adds a new blank one, so
    gda.slideRegistry.clear();
    var o = tryParseJSON(text);
    gda.restoreStateFromObject(o, false);
    }
}
function tryParseJSON (jsonString){
    try {
        var o = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns 'null', and typeof null === "object", 
        // so we must check for that, too.
        if (o && typeof o === "object" && o !== null) {
            return o;
        }
    }
    catch (e) { console.log("tryParseJSON: not JSON (" + jsonString + ")"); }

    return false;
};


// handle upload button
gda.connect_upload_button = function(elULbutton) {
  var uploader = document.getElementById(elULbutton);  

  fileReaderMethod(uploader,gda.dataReady);
}

function fileReaderMethod(uiObject,callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    callback(contents);
  };

  uiObject.addEventListener("change", handleFiles, false);  
  function handleFiles() {
    var file = this.files[0];
    console.log("==================File Load=====================");
    console.log("methodFR file name " + file.name);
    console.log("methodFR file lmd  " + file.lastModifiedDate);
    var filetype = gda.isDataFileTypeSupported(file.name);
    if (!filetype) {
        alert("File is not a supported Data file type (.csv, .xml). " + file.name);
        return false;
    }
    if (gda && gda._slide) {
        gda._slide().datafile = file.name;
        gda._slide().dataLastModifiedDate = file.lastModifiedDate;
    }
    reader.readAsText(file);
  };
}

function slideReaderMethod(uiObject,callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    callback(contents);
  };

  uiObject.addEventListener("change", handleFiles, false);  
  function handleFiles() {
    var file = this.files[0];
    console.log("==================File Load=====================");
    console.log("methodFR file name " + file.name);
    console.log("methodFR file lmd  " + file.lastModifiedDate);
    var filetype = gda.isSlideFileTypeSupported(file.name);
    if (!filetype) {
        alert("File is not a supported Slide file type (.json, .txt). " + file.name);
        return false;
    }
    if (gda) {
        gda._slidefile = file.name;
        gda._slideLastModifiedDate = file.lastModifiedDate;
    }
    reader.readAsText(file);
  };
}

// The button handler reads the file as text and returns it to dataReady.
// For a list of files, use dataArrayReady to handle.
// For a standard single CSV, use the subsequent code block
var iUid = 0;
gda.dataReady = function(data) { //    from Input button handler
    console.log("dataReady data "+data);
    var dR = d3.csv.parse(data);    // parseRows
    gda.dataNativeReady(dR);
}

gda.dataNativeReady = function(dR) {
    if (gda.bFirstRowsOnly && dR.length>gda.nFirstRows)
        //dR = [dR[0]];
        dR = _.first(dR, gda.nFirstRows);
    console.log("dataNativeReady Lin ", dR.length);
    console.log("dataNativeReady "+dR);

    if (gda._slide().bAggregate === true && gda.cf) {
    }
    else
        gda.new_crossfilter();

    if (gda._slide().bAggregate === true) {
        console.log("bAggregate, retain columns ",gda._slide().columns);
    }
    else {
        gda._slide().columns = [];  // start fresh
        gda._slide().keymap = {};   // start fresh
        gda._slide().filters = {};
    }

    if (gda._slide().bListOfMany)
        dataArrayReady(null, [dR]);
    else {
        dR = gda.dataSourceInternal(dR);    // uses gda._slide()....counter
        dR = gda.dataFilter(dR);
        // just acts on first record, so no assignment needed
        gda.dataFilterKeymapTransform(dR); // sets slide columns, unless Aggregate and data previously loaded

        // should this be moved to FilterInternal? if so user can't override unless
        // implemented in an accessible member.
        gda.dataKeymapAdd(dR); // expects array, use slice(1) if parseRows is used above.
        gda.dataComplete();
    }
}

gda.dataFilterKeymapTransform = function(dR) {
    if (dR && dR.length>0) {
        var keymap = gda._slide().keymap;   // optimize?
        var columns = gda._slide().columns;
        _.each(dR[0], function(value, key) {    // just (key) if parseRows is used.
            var keyold = key;
            key = trimColName(key);
            keymap[keyold] = key;
            if (!_.contains(columns, key))
                columns.push(key);
        });
        gda._slide().keymap  = keymap;
        gda._slide().columns = columns;
        console.log("dataFilterKeymapTranform columns " + gda._slide().columns);
    }
}

// one array of data
// filters to cleanup via keymap
// adds to crossfilter
gda.dataKeymapAdd = function(dR) { //columns,dR) {

    if (dR && dR.length>0) {
        console.log("dataKeymapAdd");
        //console.log("dataKeymapAdd b4 " + dR);
        //console.log("dataKeymapAdd b4 " + JSON.stringify(dR));
        dR = _.map(dR, function(value, key) {
            var b = {};
            // return
            _.map(value, function(v, k) {
                //k = trimColName(k);
                //return k+":"+v;
                var k1 = gda._slide().keymap[k] || k;
                b[k1] = v;
            });
            return b;
        });
        dataAdd(dR);
    }
}

// adds a counter and sets default quantity
gda.dataSourceInternal = function(data) {
    console.log("dataSourceInternal");
    if (data && data.length>0 ) {    // temporary hardwired filter for certain csv's.
        _.each(data, function(d) {
            d._counter = gda._slide().uniqueId();    // should come from data source
            d._qty = 1;
        });
    }
    return data;
}

gda.slidesLoadImmediate = function(slidespath, bDashOnly) {
    console.log("sLI:");
    gda._slidefile = slidespath;    // store path
    return gda.slideFileLoad(slidespath, bDashOnly ? gda.restoreDashOnlyDeferred : gda.restoreStateDeferred);
};

gda.slideFileLoad = function (slidespath, callback) {
    console.log("sFL:");
    if (slidespath.length>0) {
            var qF = queue(1);    // serial. parallel=2+, or no parameter for infinite.
            qF.defer(d3.json,slidespath);
            qF.awaitAll(callback); //gda.restoreStateDeferred);
            return true;
    }
    return false;
};

gda.isSlideFileTypeSupported = function(filepath) {
    var filetypeI = filepath.lastIndexOf(".");
    if (filetypeI<0 || filetypeI > filepath.length-1) {
        return false;
    }
    var filetype = filepath.substring(filetypeI+1).toLowerCase();
    switch (true) {
        //case /txt/.test(filetype):   // was used with a server that did not initially support json
        case /json/.test(filetype):
            break;  // continue
        default:
            return false;
    }
    return filetype;
};
gda.isDataFileTypeSupported = function(filepath) {
    var filetypeI = filepath.lastIndexOf("=");
    if (filetypeI<0 || filetypeI > filepath.length-1) {
        filetypeI = filepath.lastIndexOf(".");
    if (filetypeI<0 || filetypeI > filepath.length-1) {
        return false;
    }
    }
    var filetype = filepath.substring(filetypeI+1).toLowerCase();
    switch (true) {
//        case "txt":
        case /csv/.test(filetype):
        case /json/.test(filetype):
        case /xml/.test(filetype):
            break;  // continue
        default:
            return false;
    }
    return filetype;
};

// returns true if it did a deferred load
gda.fileLoadImmediate = function() {
    var filepath = gda._slide().dataprovider;
    if (!gda.utils.fieldExists(gda._slide().bLocalFile) || gda._slide().bLocalFile) filepath = filepath + gda._slide().datafile;
    if (gda.datafile !== filepath) {    // only if not already loaded.
        gda.datafile = filepath;        // most recent loaded. Only one is available at a time, changed per slide.
        gda._slide().bLoaded = false;
        if (gda._slide().bLoaded !== true) {
			if (filepath.trim().length>0) {
				var filetype = gda.isDataFileTypeSupported(filepath);
				if (!filetype) {
				alert("Unsupported file type: " + filepath);
				return false;
				}
				console.log("selFile " + filepath );
				var qF = queue(1);    // serial. parallel=2+, or no parameter for infinite.
                if (!isHttp(filepath))
				    filepath = filepath + "?q="+Math.random();	// override caching by randomly changing the request path
				console.log("selFile " + filepath + " type " + filetype);
				switch (filetype) {
				case "json":
						qF.defer(d3.json,filepath);
						qF.awaitAll((gda._slide().bListOfMany)?dataArrayReady:allDataLoaded);
						break;
				case "csv":
						qF.defer(d3.csv,filepath);
						qF.awaitAll((gda._slide().bListOfMany)?dataArrayReady:allDataLoaded);
						break;
				case "xml":
						qF.defer(d3.xml,filepath);
						qF.awaitAll(xmlDataLoaded);
						break;
				}
				return true;
			}
        }
    }
    return false;
};

function xmlDataLoaded(error, xml) {
    console.log("xml " + xml);
    console.log("xml " + JSON.stringify(xml));
};

function dataArrayReady(error, dataArray) {    // [ [{},{}] , ... ]
    console.log("bListOfMany " + gda._slide().bListOfMany);
    console.log("dataArrayReady e(" + error+") Lin ", dataArray.length);
    console.log("dataArrayReady "+JSON.stringify(dataArray) );

    // load each deferred via queue
    var qA = queue(1);    // serial. parallel=2+, or no parameter for infinite.
    console.log("dataArrayReady len " + dataArray.length);
    var cf2 = crossfilter();
    var dateDimension2 = cf2.dimension(function (d) { return d.dd; });
    var iTable2 = gda.createTable(cf2, dateDimension2, ["Tests"], sFileChartGroup);// needs it's own group
    var s9 = document.getElementById('FileTable');
    gda.newTableDisplay(s9,iTable2);//, ".dc-list-table", ".dc-list-count");
	console.log("renderALL dataArrayReady ");
    dc.renderAll(sFileChartGroup);
    for (var iDA=0;iDA<dataArray.length;iDA++){
    // add dataArray[iDA] to a dataTable with group sChartGroupList

    // add file list to a 2nd cross filter and display in a table
    cf2.add(dataArray[iDA]);

    _.each(dataArray[iDA], function(dAvalue, iInDA) {
        var dA = dAvalue;//dataArray[iDA];
	_.each(dA, function(value, key) {    // just (key) if parseRows is used.
		console.log(" defer key " + key + " v " + JSON.stringify(value));
	    var p = value;    // eliminate?
	    if (p) {        // eliminate?
            var p1 = p.replace(/\\/g,"/");
            console.log(" p " + p + " becomes " + p1);
            p = p1;
            qA.defer(d3.csv, p );   // could specify the DCcsvFilter by row here, as third param
	    }
	});
      });
    }
    //dc.redrawAll(sChartGroup);//sChartGroupList);  ? not til later.
    qA.awaitAll(allDataLoaded);  // read them all, then continue
}

function allDataLoaded(error, testArray) {
    console.log("allDataLoaded e(" + (error?error.statusText:"no error")+")");
    if (error)  {
    }
    else
    {
    console.log("allDataLoaded in " + testArray.length + " <==========");
    if (testArray && testArray.length>0 && testArray[0] && testArray[0].length>0) {
        for (var i=0;i<testArray.length && (i<gda.nFirstRows || !gda.bFirstRowsOnly) ;i++){   // 1+. 0 is column headings
            console.log("allDataLoaded: filtering " + (i+1) + " of " + testArray.length);
            dR = testArray[i];
            if (gda.bFirstRowsOnly && dR.length>gda.nFirstRows)
                //dR = [dR[0]];
                dR = _.first(dR, gda.nFirstRows);
            dR = gda.dataSourceInternal(dR);
            dR = gda.dataFilter(dR);    // operates on one set

            // just acts on first record, so no assignment needed
            // however, this sets the available columns
            gda.dataFilterKeymapTransform(dR);

            testArray[i] = dR;
        }

        console.log("allDataLoaded Lin " + testArray.length );

        if (gda._slide().bAggregate === true && gda.cf) {
        }
        else
            gda.new_crossfilter();

        // have been two forms of data, row0=colheadings, and, {colheading: value}
        for (var i=0;i<testArray.length && (i<gda.nFirstRows || !gda.bFirstRowsOnly) ;i++){   // 1+. 0 is column headings
            console.log("allDataLoaded dataKeymapAdd ");
            var dR = testArray[i];
            gda.dataKeymapAdd(dR);
            testArray[i] = dR;
        }
    }

    console.log("allDataLoaded done  <==========");

    gda.dataComplete();
    }
}

function dataAdd(data) {
    gda.cf.add(data);
    //console.log("dataAdd data " + data);
    //console.log("dataAdd data " + JSON.stringify(data));
    console.log("dataAdd cf now at "+ gda.cf.size());
}

// placeholder for user override
gda.dataFilter = function(data) {
    console.log("gda.dataFilter");
    return data;
}

function trimColName(cname) {
    if (cname.trim().length===0) cname = "blank"+(++iUid);
    else {
        cname = cname.replace(/\&/g,"_");    // replace ampersands
        cname = cname.replace(/\./g,"_");    // replace periods
        cname = cname.replace(/\n/g,"_");    // replace newline
        cname = cname.replace(/ /g,"_");    // replace spaces
        cname = cname.replace(/:/g,"_");    // replace colons
        cname = cname.replace(/,/g,"_");    // replace commas
        cname = cname.replace(/\//g,"_");    // replace slash
        cname = cname.replace(/\(/g,"");    // remove parens
        cname = cname.replace(/\)/g,"");    // remove parens
    }
    //cname = capitalize(cname); // preferred, but not the right way/place
    console.log("Cleaned Column Name: " + cname );
    return cname;
}

function capitalize(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// end File Handling

////////////////////////////////


// HTML creation

gda.addElement = function(dElHost, elType) {
    var dEl = document.createElement(elType);
    dElHost.appendChild(dEl);
    return dEl;
}
gda.addElementWithId = function(dElHost, elType, id) {
    var dEl = document.createElement(elType);
    dEl.id = id;
    dElHost.appendChild(dEl);
    return dEl;
}

gda.addTextNode = function(dElHost, txt) {
    var dEl = document.createTextNode(txt);
    dElHost.appendChild(dEl);
    return dEl;
}

gda.addRadioB = function(dElHost, theId, theValue, sLabel, className, defV, changedCallback) {
    var radiob = document.createElement("input");
    radiob.type = "radio";
    radiob.class = className;
    radiob.id = "c"+dElHost.id+"c"+theId;
    radiob.name = "Cradio"+dElHost.id;
    radiob.value = theValue;
    radiob.checked = defV;
    dElHost.appendChild(radiob);
    d3.selectAll("input[id="+radiob.id+"]")
        .on("change",
            function() {
            changedCallback(this);
            });
    var Luse = document.createElement("label");
    Luse.htmlFor = radiob;
    Luse.appendChild(document.createTextNode(sLabel));
    dElHost.appendChild(Luse);
    return gda;
}
gda.addCheckB = function(dElHost, theValue, sLabel, className, defV, changedCallback) {
    var checkb = document.createElement("input");
    checkb.type = "checkbox";
    checkb.class = className;
    checkb.id = "c"+dElHost.id+"c"+theValue;
    checkb.name = "c"+dElHost.id;
    checkb.value = theValue;
    checkb.checked = defV;
    dElHost.appendChild(checkb);
    d3.selectAll("input[id="+checkb.id+"]")
        .on("change", changedCallback);
    var Luse = document.createElement("label");
    Luse.htmlFor = checkb;
    Luse.appendChild(document.createTextNode(sLabel));
    dElHost.appendChild(Luse);
    return gda;
}
gda.addButton = function(dElHost, theValue, sLabel, callback) {
    var button = document.createElement("input");
    button.type = "button";
    button.value = sLabel;
    button.name = "button";
    button.id = "c"+dElHost.id+"c"+theValue;
    dElHost.appendChild(button);
    d3.selectAll("input[id="+button.id+"]")
        .on("click", function() { callback(this); });
    return gda;
}
gda.addUploader = function(dElHost, theValue, callback) {
    var button = document.createElement("input");
    button.type = "file";
    button.id = "c"+dElHost.id+"c"+theValue;
    dElHost.appendChild(button);
    if (!callback) callback=gda.dataReady;
    fileReaderMethod(button,callback);
    return gda;
}
gda.addSlideOpen = function(dElHost, theValue) {
    var button = document.createElement("input");
    button.type = "file";
    button.id = "c"+dElHost.id+"c"+theValue;
    dElHost.appendChild(button);
    button.textContent = "Open Slides";
    var callback= gda.restoreState;
    slideReaderMethod(button,callback);
    return gda;
}

gda.addTextEntry = function(dElHost, fieldname, defV, callback) {
    // slide title
    var inputT = document.createElement("input");
    inputT.type = "text";
    inputT.id = "C"+fieldname.replace(/ /g,"_").replace(/:/g,"_");	
    inputT.name = fieldname;//.replace(/ /g,"_").replace(/:/g,""); 08/16/2014 unneeded?	// was ,"_", causes fieldname to not match list
    inputT.value = defV;
    var Luse = document.createElement("label");
    Luse.htmlFor = inputT;
    Luse.appendChild(document.createTextNode(fieldname+':'));
    dElHost.appendChild(Luse);
    dElHost.appendChild(inputT);
    d3.selectAll("input[id="+inputT.id+"]")
        .on("change",
            function() {
            callback(this.value, this.name);
            });
    return gda;
}

// end HTML creation

////////////////////////////////

// junk?
function indexOfNonMatch (str1, str2) {
    var found;
    var stri;
    var strj;
    var i = 0;

    for (i = 0; i < str1.length && i < str2.length && String.fromCharCode(str1.charCodeAt(0) ^ str2.charCodeAt(0)); i++);

    return i;
}

// statistics
    gda.stats = {};
    gda.stats.accessor = function (property) {
        return function (d) {
            return d[property];
        };
    };

    gda.stats.reduceStats = function (group, accessor) {
        return group.reduce(function (p, v) {
            p.count++;
            var vv = accessor(v);
            p.sum += vv;
            p.sumOfSquares += (vv * vv);
            return p;
        }, function (p, v) {
            p.count--;
            var vv = accessor(v);
            p.sum -= vv;
            p.sumOfSquares -= (vv * vv);
            return p;
        }, function (p) {
// determine how to factor in access to StDev efficiently.
// double fNumerator = m_fSumOfSquares - m_fSum * m_fSum / m_nCount;
// 	if ( fNumerator > 0.0 )
// 	    fReturn = System.Math.Sqrt( fNumerator / ( m_nCount - 1 ) );
// fVar = System.Math.Abs((fMax - fMin)/fAvg);  // Variance
// fCP
// fCPK
// fStdevFromMean(fStdevCount) = this.fAvg + fStdevCount * this.fStDev;

            return { count: 0, sum: 0, sumOfSquares: 0, valueOf: function () {
                return this.count !== 0 ? this.sum / this.count : 0;
            }};
        });
    };

    gda.stats.reduceCount = function (group) {
        return group.reduce(function (p, v) {
            return ++p;
        }, function (p, v) {
            return --p;
        }, function (p) {
            return 0;
        });
    };

    gda.stats.reduceSum = function (group, accessor) {
        return group.reduce(function (p, v) {
            var val = accessor(v);
            return val !== null ? p += val : p;
        }, function (p, v) {
            var val = accessor(v);
            return val !== null ? p -= val : p;
        }, function (p) {
            return 0;
        });
    };


return gda; })();
