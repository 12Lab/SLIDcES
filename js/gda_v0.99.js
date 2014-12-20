// make dataset globally available

// next: tables tables tables
// it would be nice to add in jsonlint to clean up output for saving
// "I'm new" checkbox. Large tooltips. jqueryui.
// Cleaner? move dS/mS to a separate page/tab/slide,
// dS/mS only pages not shown during runtime, but can appear as a dS edit page during edit mode.
// best benefit would then have reduced selections 'clutter' on slide pages.
// gaaware.com?
// slides.com - can it host other engines?
// refactor gda into 1) single slide display, 2) slide engine, 3) data package, 4) filters, 5) 'file' package on top of queue, so it can be used elsewhere 6) explore Twine (http://twinery.org/, http://twinery.org/2/#stories, perhaps with http://www.motoslave.net/sugarcube/)

// would like to activate dashboard chart rollups but need to improve the design first, required meta->data sources that do not
// have a displayed chart are not loaded. requires any chart display on the meta/data to load and correctly process the 'normalize'
// also does not presently throw an error if it's missing

var sFileChartGroup = "FileListGroup";  // temporary, for the File List table

gda = (function(){
'use strict';

    if (!Array.prototype.clear) {
        +function () {
        Array.prototype.clear = function() {
          while (this.length > 0) {
            this.pop();
          }
        }
        }();
    }


    /* Array.joinWith - shim         by Joseph Myers  7/ 6/2013 */
    /*   modified to accept 1+ keys, by Chris Meier  10/22/2014 */
    // leaves the .k1.k2.k3 keys, need to add a pass to remove
    // as each array object also gets the expanded/join set.
    // has side effect of adding this proto to every array instance,
    // even if no intention to use.
    if (!Array.prototype.joinWith) {
        +function () {
            Array.prototype.joinWith = function(that, byA, select, omit) {
                var together = [], length = 0;
                if (select) select.map(function(x){select[x] = 1;});
                function fields(it) {
                    var f = {}, k;
                    for (k in it) {
                        if (!select) { f[k] = 1; continue; }
                        if (omit ? !select[k] : select[k]) f[k] = 1;
                    }
                    return f;
                }
                function add(it) {
                    var pkey = '';
                    _.each(byA, function(by) {
                        pkey=pkey+'.'+it[by];
                    });
                    var pobj = {};
                    if (!together[pkey]) together[pkey] = pobj,
                        together[length++] = pobj;
                    pobj = together[pkey];
                    for (var k in fields(it))
                        pobj[k] = it[k];
                }
            this.map(add);
            that.map(add);
            return together;
            }
        }();
    }

document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (gda && gda.clickModifiers) {
        gda.clickModifiers = {};
        if (evt.ctrlKey) gda.clickModifiers.ctrlKey = true;
        if (evt.shiftKey) gda.clickModifiers.shiftKey = true;
        //gda.log(4,"okd click actions " + JSON.stringify(gda.clickModifiers));
    }
    if (evt.ctrlKey && evt.shiftKey) {
        if (evt.keyCode != 16 && evt.keyCode != 17) {
            if (evt.keyCode == 188)
                gda.view.showPrev();
            else if (evt.keyCode == 38) {}
            else if (evt.keyCode == 190)
                gda.view.showNext();
            else if (evt.keyCode == 40) {}
        }
    }
};

document.onkeyup = function(evt) {
    if (gda && gda.clickModifiers) {
        gda.clickModifiers = {};
        //gda.log(4,"oku click actions cleared");
    }
};
    

var gda = {
    version: "0.099",
    minor:   "105",
    branch:  "gdca-dev",

    T8hrIncMsecs     : 1000*60*60*8,      // 8 hours
    TdayIncMsecs     : 1000*60*60*24,     // 1 day
    TweekIncMsecs    : 1000*60*60*24*7,   // 1 week
    TmonthIncMsecs   : 1000*60*60*24*30,  // 1 month    // bit over for Feb?
    TquarterIncMsecs : 1000*60*60*24*90,  // 1 quarter
    TyearIncMsecs    : 1000*60*60*24*365, // 1 year


    _allowDSMS : true,
    _allowEdit : false,
    _anchorEdit : null,     // document element, where Slide Edit controls are placed
    _anchorNav : null,      // document element, where Slide Navigation controls are placed
    _anchorSlide : null,    // document element, where the Slide is placed


    _currentSlide : 0,           // active slide in set
    _slidefile : "",
    _slide: function() {
                var sl = gda.slides.list();
                if (sl.length === 0) {
                    gda.log(4,"creating default slide");
                    // could do a delay, then retry the sl =.
                    // timing issue when doing a fwd/back in the browser
                    // as a redraw is kicked off before the slide file is
                    // loaded. the 1.0 sec timer (should be at 0.250 sec)
                    // could be part of the problem.
                    gda.view.append();
                }
                return sl[gda._currentSlide];
            },

    cf : {},              // data is aggregated in crossfilter
    dimensions : {},
    sChartGroups : [],
    sEdS : null,             // dS used for editing
    sEmS : null,             // mS used for editing

    editCols : {              // selections, really just the current checkboxes selected in the control section.
                            // these are only needed when editing
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
    slideRefs : [],
    dateDimension : null,
    bDashOnly : false,
                                // current slide's state
    bShowDataSource : false,    // offset interface to choose a(nother) data file?
    bShowSlidesSource : false,  // offer interface to view other slide sets?
    bEditTrimmed : false,
    bFirstRowsOnly : false,
    nFirstRows : 100,
    //bSparseData : false, // workaround, until DataSource

    bPollTimer : false,     
    bPollTimerRunning : false,
    nPollTimerExpires : 0,
    bPollAggregate : false,
    bPolledAndViewDrawn : {},
    nPollTimerMS : 5000,

    SFwait: 0,

    // These are used only for next/prev slide 'focus' change. Prob a better way.
    sEditPresentTextControl1 : "CPollTimerMS",
    sEditPresentTextControl2 : "CSlideTitle",

    sTextHTML : "textContent",//"innerHTML"; textContent works in FireFox, while innerHTML doesn't
    Hone : "h2",
    Htwo : "h4",

    sTimingDS : "_Acquisition",

    // registered simple or aggregated charts
    availCharts : ["Format_Newline", "Timeline", "Scatter", "Pareto", "Bar", "Row", "Line", "Hist", "Series", "Bubble", "ScatterHist", "Choropleth", "Box", "Stats"],

    numFormats : [".2f", "%Y%m%d", ".0f" ], // not a great idea. turn into an object
    defFormat : 0,
    clickModifiers: [],
    layoutRow : 0,
    bAny : false,
    diag : 0        // 0='get' time, 1= +tick+progress, 2= +file, 3= +scatterD, 4= +all
};


gda.spinner = function(config) {
  var _iLevels = 0;
  var _config = {innerRad: 0.4, outerRad: 0.9,
                 endRad: 1.15, startRad: 0.35,// C
                 width: 50, height: 50,
                 container: "#Spinner", id: "spinner"};
  var _levelsArc = [];
  var _bkg = [];
  var tau = 2 * Math.PI;
  var _svg = null;
  var bOnceOnly = true;

    function spin(selection, duration) {
        if (_iLevels>1 || bOnceOnly) {
        selection.transition()
            .ease("linear")
            .duration(duration)
            .attrTween("transform", function() {
                return d3.interpolateString("rotate(0)", "rotate(360)");
            });

        setTimeout(function() { spin(selection, duration); }, duration);
        }
    }

    function transitionFunction(path) {
        path.transition()
            .duration(7500)
            .attrTween("stroke-dasharray", tweenDash)
            .each("end", function() { d3.select(this).call(transition); });
    }

  return {
    create: function() {
        if (config) _config = config;
        _config.radius = Math.min(_config.width, _config.height) / 2;


        gda.log(0,"spin0 ",_iLevels);
        gda.log(0,"arcs ",_levelsArc.length);
    },
    start: function() {
        _iLevels++;
        if (_iLevels===1) {
            var arc = d3.svg.arc()
                    .innerRadius(_config.radius* _config.innerRad)
                    .outerRadius(_config.radius* _config.outerRad)
                    .startAngle(_config.startRad*tau);
            _levelsArc.push(arc);

            _svg = d3.select(_config.container).append("svg")
                .attr("id", _config.id)
                .attr("width", _config.width)
                .attr("height", _config.height)
              .append("g")
                .attr("transform", "translate(" + _config.width / 2 + "," + _config.height / 2 + ")")

            _bkg.push( _svg.append("path")
                    .datum({endAngle: _config.endRad*tau})
                    .style("fill", "#4D4D4D")
                    .attr("d", _levelsArc[0]) 
                    //.call(spin, 1500)
                    );
            gda.log(0,"spin+ ",_iLevels);

            if (bOnceOnly) {
                _bkg[0]
                    .call(spin, 1500);
                bOnceOnly = false;
            }
        }
        else if (_iLevels>1) {
            var arcStrip = d3.svg.arc()
                    .innerRadius(_config.radius* _config.innerRad *(1 + (1*_iLevels)/10))
                    .outerRadius(_config.radius* _config.innerRad *(1 + (1*_iLevels+1)/10))
                    .startAngle(0);//_config.startRad*tau);
            _levelsArc.push(arcStrip);
            _bkg.push( _svg.append("path")
                    .datum({endAngle: 0.7*tau})//_config.endRad*tau
                    .style("fill", "#00AD00")
                    .attr("d", _levelsArc[_iLevels-1])
                    .attr("id", "spin"+_iLevels)
                    );
            _bkg[_iLevels-1].call(spin,1000);
        }
        gda.log(0,"arcs ",_levelsArc.length);
    },
    stop: function() {
        if (_iLevels>0) {
           _levelsArc.pop();
           _bkg.pop();
            d3.select(_config.container).select('svg').select('g').select('path#spin'+_iLevels).remove();
            _iLevels--;
        }
        else {
            gda.log(0,"attempted extra stop");
        }
        if (_iLevels === 0) {
            _svg.selectAll("*").remove();
            d3.select(_config.container).select('svg').remove();
        }
        gda.log(0,"spin- ",_iLevels);
        gda.log(0,"arcs ",_levelsArc.length);
    }

  };

}

gda.spinnerDef = {innerRad: 0.4, outerRad: 0.9,
                  endRad: 1.15, startRad: 0.35,// C
                  width: 50, height: 50,
                  container: "#Spinner", id: "spinner"};
gda.mySpinner = document.getElementById(gda.spinnerDef.container.substring(1)) ? gda.spinner(gda.spinnerDef) : null;


gda.numberFormat = d3.format(gda.numFormats[gda.defFormat]);
gda.dateFormat = d3.time.format(gda.numFormats[1]);  // hmm not great
gda.daysFormat = d3.format(gda.numFormats[2]); 
gda.counterFormat = d3.format("08d");

gda.newTableState = function() {
    var _aTable= {};
    _aTable.bUseTable = true;
    _aTable.bHideShowTable = false;
    _aTable.bShowTable = true;
    _aTable.bShowLinksInTable = false;
    _aTable.bShowPicturesInTable = false;
    _aTable.bShowTableColumnSelectors = false;

    _aTable.csetupSortTableCols = [];
    _aTable.csetupHiddenTableCols = [];

    // these should be in another method, 'wrapping' this one.
    _aTable.dataSource = gda.activedataSource();
    _aTable.sChartGroup = gda.activedataSource();   // both for now
    if (_aTable.dataSource) {
        // default to first column
        var ds = gda.activeDatasource();
        var cname = ds && ds.columns.length>0 ? ds.columns[0] : null;
        if (cname)
        _aTable.csetupSortTableCols = [cname];
    }

    return _aTable;
}

gda.newDataSourceState = function() {
    var _aDatasource = {};
    _aDatasource.dataprovider = "";
    _aDatasource.datafile = "";
    _aDatasource.bLocalFile = true;
    _aDatasource.bLoaded = false;
    _aDatasource.bListOfMany = false;
    _aDatasource.bAggregate = false;
    _aDatasource.bSparseData = false;
    _aDatasource.bTimestamp = false;
    _aDatasource._idCounter = 0;
    _aDatasource.keymap = {};
    _aDatasource.columns = [];  // ? was {}


    return _aDatasource;
}

gda.newMetaSourceState = function() {
    var _aMetasource = {};
    _aMetasource.type = "cf";   // or "join", or "orderedOps"
    _aMetasource.dataSources = [];
    _aMetasource.bLoaded = false;
    _aMetasource.keymap = {};
    _aMetasource.columns = [];

    return _aMetasource;
}

gda.activedataSource = function() { // one of sEdS or sEmS should be active
    var dS = null;
    if (gda.sEmS) dS = gda.sEmS;
    else if (gda.sEdS) dS = gda.sEdS;
    return dS;
}
gda.activeDatasource = function() { // one of sEdS or sEmS should be active
    var ds = null;
    if (gda.sEmS) ds = gda.metaSources.map[gda.sEmS];
    else if (gda.sEdS) ds = gda.dataSources.map[gda.sEdS];
    return ds;
}

//gda.dataSource = function( _ds ) {    // used to decorate a ds definition for operations
//    var _aDS  = _ds ? _ds : {};
//    _aDS.__dc_flag__ = dc.utils.uniqueId();
//    _aDS.uniqueId = function() {
//    };
//    return _aDS;
//};

gda.metaSources = {};
gda.metaSources.map = {};
//gda.metaSources.map.none = gda.newMetaSourceState();
gda.metaSources.asText = function() {
    var dss = gda.metaSources.map;
    var t = JSON.stringify(dss);
    t = t.replace(/{\"/g,'{\r\n\"');
    t = t.replace(/},\"/g,'\},\r\n\"');
    return t;
};
gda.metaSources.restore = function(metaSourceMap) {
    if (!gda.utils.fieldExists(gda.metaSources.map))
        gda.metaSources.map = {};

    _.each(metaSourceMap, function(aMetaSource, dS, dsEntry) {
        var dsRestored = jQuery.extend(true, gda.newMetaSourceState(), aMetaSource);   // add any missing fields.
        gda.log(4,"rs: dS " + dS );
        if (gda.utils.fieldExists(dsRestored.type) &&
            (dsRestored.type === "join" ||
            dsRestored.type === "cf" ) )
            gda.log(4,"rs: metaSource join/cf " + JSON.stringify(dsRestored));

        gda.metaSources.restoreOne(dS, dsRestored);

        // don't load until referenced?
    });
}

gda.log = function(L,a,b,c) {
    //console.log("DO: ",gda.bDashOnly);
    if (L<=gda.diag)
        if (c !== undefined)
            console.log(a,b,c);
        else if (b !== undefined)
            console.log(a,b);
        else
            console.log(a);
}

gda.dataSources = {};
gda.dataSources.map = {};
//gda.dataSources.map.none = gda.newDataSourceState();
gda.dataSources.uniqueId = function(ds) {
    if (ds === undefined) {
        alert("undefined, resource issue");
        return 0;
    }
    else
    return ++(ds._idCounter);
};
gda.dataSources.updateColumns = function() {
    if (gda.sEmS) {
    var mS = gda.sEmS;
    var ms = gda.metaSources.map[mS];
    // need to join the keymaps+
    var rA = gda.dataSources.map[ms.dataSources[0]].columns;    // could use _.first(results);
    _.each(_.rest(ms.dataSources), function(dS) {
        var rB = gda.dataSources.map[dS].columns;
        rA = rA.joinWith(rB, gda.dataSources.map[dS].keys);
    });
    ms.keymap = rA;
    }
};

// from: https://groups.google.com/forum/#!topic/dc-js-user-group/rBEViYG8bBE
// alternative, but just for one key (at least this example):
//      You don't need to join the data fully prior to passing it to crossfilter,
//      provided you have a common join key. For example:
//
//      var metaData = otherCsvData.reduce(function(p,d) {
//        p[d.myJoinKey] = d;
//        return p;
//      }, {});
//      var ndx = crossfilter(primaryData);
//      var dimension = ndx.dimension(function(d) { return metaData[d.myJoinKey].joinDataThing; });
//
// another alternative, is to do a join in the accessor
//
// also explore code in https://github.com/gajus/interdependent-interactive-histograms

gda.dataSources.asText = function() {
    var dss = gda.dataSources.map;
    // workaround, bLoaded should be in a ds 'state' object, not in the stored/restored data
    _.each(dss, function(ds) {
        delete ds.bLoaded;
    });
    var t = JSON.stringify(dss);
    t = t.replace(/{\"/g,'{\r\n\"');
    t = t.replace(/\"keymap\"/g,'\r\n\"keymap\"');
    t = t.replace(/},\"/g,'\},\r\n\"');
    return t;
};

gda.dataSources.restore = function(dataSourceMap) {
    if (!gda.utils.fieldExists(gda.dataSources.map))
        gda.dataSources.map = {};

    _.each(dataSourceMap, function(aDataSource, dS, dsEntry) {
        var dsRestored = jQuery.extend(true, gda.newDataSourceState(), aDataSource);   // add any missing fields.
        gda.log(4,"rs: dS " + dS );
        if (gda.utils.fieldExists(dsRestored.type) &&
            (dsRestored.type === "join" ||
            dsRestored.type === "cf" ) )
            alert("rs: dataSource join/cf " + JSON.stringify(dsRestored));
        else
            gda.log(4,"rs: dataSource " + dsRestored.dataprovider + dsRestored.datafile);

        gda.dataSources.restoreOne(dS, dsRestored);

        // don't load until referenced? ideally. but see gda.displayCharts for a short discussion on
        // timing. Should user be given control over whether a DataSource (dS) instantiates a cf? Or
        // just have a chart/control reference drive the source to be loaded? We don't want to just
        // load all dS as cf, except during Edit/design time, since there is no point to specify a
        // new one unless you intend to work with it.
        // Another possibility is to load/process the dS/mS when the correponding sChartGroup is
        // added to gda.sChartGroups. But not needed for edit/design time, so do it in the chart
        // restore section.
    });
}

gda.dataSources.uniqueIndex = 0;

gda.dataSources.restoreOne = function(dS, dsRecord) {
    if (dS === "blank") dS = dS + (++gda.dataSources.uniqueIndex);
    if (gda.utils.fieldExists(gda.dataSources.map[dS])) {   // do nothing if already present.
        gda.log(4,"dataSources: tossed extraneous " + dS);
    }
    else {
        gda.dataSources.map[dS] = JSON.parse(JSON.stringify( dsRecord )); // cleanup/copy
        // although the crossfilter could be set up here, it presently isn't until the data is loaded.
    }
    if (gda.dataSources.map[dS].bTimestamp) {    // also use this flag to add timing information to a crossfilter
                            // and assure it is available as a dataSource (runtime, not stored)
        if (!gda.utils.fieldExists(gda.dataSources.map[gda.sTimingDS])) {
            var _aDatasource = {};  // create a special internal one for Timing
            _aDatasource._idCounter = 0;
            _aDatasource.columns = [
                                    "Timestamp_get",
                                    "Timestamp_complete",
                                    "TimeMS"
                                    ];
            gda.dataSources.restoreOne(gda.sTimingDS, _aDatasource);
        }
    }
    return dS;
}

gda.metaSources.uniqueIndex = 0;

// Refactor this back to just restoring the definition, but not the data
// until needed

gda.metaSources.restoreOne = function(dS, dsRecord) {
    if (dS === "blank") dS = dS + (++gda.metaSources.uniqueIndex);
    if (gda.utils.fieldExists(gda.metaSources.map[dS])) {   // do nothing if already present.
        gda.log(4,"tossed extraneous " + dS);
        return dS;
    }
    else {
        gda.metaSources.map[dS] = JSON.parse(JSON.stringify( dsRecord )); // cleanup/copy

        // this needs refactoring to slide prep for display time
        if (gda.utils.fieldExists(dsRecord.type) && 
            (dsRecord.type === "join" ||
             dsRecord.type === "cf" ) ) {
                switch(dsRecord.type) {
                    case "join":
                        if (gda.mySpinner) gda.mySpinner.start();
                        // perform a join using the keys+, on includes dataSources+
                        // prior to handing off to crossfilter
                        var qF = queue(1);    // serial. parallel=2+, or no parameter for infinite.
                        _.each(dsRecord.dataSources, function(ds) {
                            // need helper function
                            var dsR = gda.dataSources.map[ds]; // only allows 1 deep
                            var fn = dsR.dataprovider+dsR.datafile;
            // needs update. files should be loaded now, this should just setup the join
                            qF.defer(d3.csv, fn); // temp, just call csv directly. need generic handler for a file, passing in a callback
                        });
                        qF.awaitAll(function(error, results) {
                                        gda.log(4,"prepareJoin e(" +
                                               (error ?
                                                    (error.message ? 
                                                        error.message
                                                        :error.statusText)
                                                    :"no error")+")");
                                        if (error || !results || results.length<1)  {
                                            gda.log(4,"prepareJoin: needs more than 1!");
                                        }
                                        else
                                            gda.metaSources.readyJoin(dS, dsRecord.type, dsRecord.keys, results);
                        });
                        break;
                    case "cf":
                        // add a dimension to the cf for subsequent use, for now hardwire to support 1
                        // the cf comes from the dataSource's cf
                        //var cf = gda.cf[dsRecord.dataSources[0]];
                        //var dD = gda.dimensionByCol(dS, dsRecord.columns[0],cf,true);
                        //cf[dsRecord.columns[0]] = dD;
                        // the cf for the dataSource isn't set up yet, and even if so the dimension cannot be created (I think) until the
                        // data has been loaded. so defer the setup to the referencing chart.
                        break;
                }
        }
        return dS;
    }
}

gda.metaSources.readyJoin = function(dS, rType, keys, results) {
    gda.log(4,"rJ: " + dS);
    // used upon loading in for both cf, join
    var rA = results[0];    // could use _.first(results);
    _.each(_.rest(results), function(rB) {  // test for results.length == 1
        var t0 = jQuery.isArray(keys);
        var t1 = _.first(_.toArray(keys));
        rA = rA.joinWith(rB, t0 ? keys : t1);

    });     // eventually support individual keys sets for each array to join
            // but for now, joinWith only accepts one set, so choose first if
            // an object with multiple are provided.

    rA = gda.dataNativeReady(dS,rA);

    ingestArray(dS, [rA]);
};

gda.datasource = function( _datasource ) {
    var _aDatasource = _datasource ? _datasource : {};
    // expand as needed

    return _aDatasource;
}

// adds a counter and sets default quantity
gda.dataSourceInternal = function(ds, data) {
    gda.log(4,"dataSourceInternal");
    var Now = new Date();   // should be set when io triggered or when read is finished
    if (data && data.length>0 ) {    // temporary hardwired filter for certain csv's.
        _.each(data, function(d) {
              if (ds.bTimestamp)
                d.Timestamp = Now;
              // can't use omit, it returns a copy
              // either process in place, or, loop above via index
              // and reassign back into data[i]
              _.each(ds.trimmed, function(k) {
                  delete d[k];
              });
              //d = _.omit(d, ds.trimmed);  // doesn't work
            d._qty = 1;
            d._counter = gda.counterFormat(gda.dataSources.uniqueId(ds));
            //gda.log(4,"dSI: counter " + d._counter);
        });
    }
    return data;
}


gda.allowEdit = function() {
    return gda._anchorEdit &&
        gda._allowEdit;
}
gda.allowOverrides = function() {
    return gda._anchorEdit || gda._slide().bAllowOverrideChanges;
}
gda.accessOverrides = function() {
    return gda.allowOverrides() && gda._slide().bAccessOverrides;
}

// Presently there is only an 'active' selections state. Need persistable content.
// Table (has 'singleton' (OBS); needs name, type, options; each needs hidden columns (per table instance) )
// Dims  (has col name; needs name, type, options)
// Chart (represents current selections, perhaps best to go back to gda.?)

gda.newSlideState = function() {
    var _aSlide = {};
    _aSlide.title = "Blank"+dc.utils.uniqueId();

    // data source as applied on this slide
    _aSlide.columns = [];   // columns available, from previously loaded data
    _aSlide.filters = {};

    // Dimension 'selector charts' chosen, by 'column'.
    _aSlide.myCols = {              // selections, really just the current checkboxes selected in the control section.
        // .dataSource.
        //    "csetupDimsCols" : [],      // which Dim charts are selected/shown
        //    "csetupHiddenTableCols" : [],// default hidden columns for table
        //    "csetupSortTableCols" : []   // column(s) selected for table sort
    };

    // chart related
    _aSlide.charts = [];            // newChartState's.

    _aSlide.tables = [];            // new Tables's.
    _aSlide.bShowDataSource = false;    // maybe these should be implemented as Slide overrides. However no method implemented yet to remove an override
    _aSlide.bShowSlidesSource = false;  // offer interface to view other slide sets?
    _aSlide.bPollTimer = false;
    _aSlide.bPollAggregate = false;
    _aSlide.nPollTimerMS = 5000;

    _aSlide.bAllowOverrideChanges = false;
    _aSlide.bAccessOverrides = false;
    return _aSlide;
};

// prototype for a Chart: Title, col dims, chart type
gda.newChartState = function() {
    var _aChart = {};
    _aChart.Title = "Blank"+dc.utils.uniqueId();
    //_aChart.Desc = "";
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
    _aChart.sourceCurrent = function(text) {    // for now, until GUI to select dS or mS
        // update stored slide definition
        var aChart = _.findWhere(gda._slide().charts, {Title: _aChart.Title, sChartGroup: _aChart.sChartGroup});
        if (text) {
            aChart.sChartGroup =  text;
            _aChart.sChartGroup = text;
        }
    };
    _aChart.titleCurrent = function(text) {
        // update stored slide definition
        var aChart = _.findWhere(gda._slide().charts, {Title: _aChart.Title, sChartGroup: _aChart.sChartGroup});
        aChart.Title =  text ? text : "Blank"+dc.utils.uniqueId();
        _aChart.Title = aChart.Title;
        // redraw anything?
        if (_aChart.titleEl) {
            _aChart.titleEl[gda.sTextHTML] = _aChart.Title;
        }
    };
    _aChart.descCurrent = function(text) {
        // update stored slide definition
        var aChart = _.findWhere(gda._slide().charts, {Title: _aChart.Title, sChartGroup: _aChart.sChartGroup});
        aChart.Desc =  text ? text : "Blank"+dc.utils.uniqueId();
        _aChart.Desc = aChart.Desc;
        // redraw anything?
        if (_aChart.descEl) {
            _aChart.descEl[gda.sTextHTML] = _aChart.Desc;
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
            if (gda.utils.fieldExists(d.key) && gda.utils.fieldExists(d.value) && d.key && d.key.trim) {
                return (d.key.trim() === "" ? "(blank)" : d.key ) + ": " + d.value ;
            } else if (gda.utils.fieldExists(d.data) && gda.utils.fieldExists(d.data.key) && gda.utils.fieldExists(d.data.value) && d.data.key.trim) {
                return (d.data.key.trim() === "" ? "(blank)" : d.data.key ) + ": " + d.data.value ;
            } else
                return "(N/A)";
        };

// eventually replace addDateOptions with this everywhere, but for the short term don't incur too much work updating
gda.utils.addDateOption = function(d,base,just) {
    var insHere = d;
    var tset = ["Year", "Quarter", "QoY", "Month", "Week", "Day", "DoW"];
    if (just !== undefined) {
	tset = [just];
    }
    _.each(tset, function(j) {
	var res = null;
	switch(j.toLowerCase()) {
		case "year":
			insHere[base+j ] = d3.time.year(d[base]);
			break;
		case "quarter":
			insHere[base+j ] = d3.time.quarter(d[base]);
			break;
		case "qoy":
			insHere[base+j ] = 1+Math.floor(d3.time.month(d[base]).getMonth()/3); // this one isn't supported by D3 (yet).
			break;
		case "month":
			insHere[base+j ] = d3.time.month(d[base]);
			break;
		case "week":
			insHere[base+j ] = d3.time.week(d[base]);
			break;
		case "day":
			insHere[base+j ] = d3.time.day(d[base]);
			break;
		case "dow":
			insHere[base+j ] = d[base].getDay();
			break;
	}
    });
};

gda.utils.addDateOptions = function(d,base) {	//,tier
    var insHere = d;
    //if (tier !== null && tier !== undefined) {
    //    if (!gda.utils.fieldExists(d[tier]))
    //        d[tier] = {};
    //    insHere = d[tier];
    //}
    insHere.Year = d3.time.year(base);
    insHere.Quarter = d3.time.quarter(base);
    insHere.QoY = 1+Math.floor(d3.time.month(base).getMonth()/3); // this one isn't supported by D3 (yet).
    insHere.Month = d3.time.month(base);
    insHere.Week = d3.time.week(base);
    insHere.Day = d3.time.day(base);
    insHere.DoW = base.getDay();
};

gda.setOverride = function( anObj, key, newVal ) {
    //gda.log(5,"field " + fieldName + " override " + _aChart.overrides[fieldName] + " " + newVal);
    if (typeof(newVal)==="string") {
        if (newVal === "false") newVal = false;     // otherwise "false" is 'true'
        else if (newVal === "true") newVal = true;  // for consistency
    }
    anObj.overrides[key] = newVal;
};
gda.addOverride = function( anObj, key, value ) {
    if (!anObj.overrides) 
        anObj.overrides = {};
    if (!gda.utils.fieldExists(anObj.overrides[key])) { // Timeline bar issue if removed
        anObj.overrides[key] = value;
    }
};

gda.activeChartGroups = function() {
    if (gda.sEdS)
        return _.union(gda.sChartGroups, [gda.sEdS]);
    else
        return gda.sChartGroups;
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
        //gda._slide().columns = [];
        gda._slide().filters = {};
        gda.clearWorkingState();
    };
    _aSlide.clearDisplay = function() {
        gda.log(4,"clearDisplay:");
        gda.layoutRow = 0;
        if (gda._anchorSlide) gda._anchorSlide[gda.sTextHTML] = "";
        _.each(gda.activeChartGroups() , function(sChartGroup) {
            dc.deregisterAllCharts(sChartGroup);
        });
    };

    // starts with a slide clear (and data structures) since the view level uses this to change pages
    _aSlide.display = function() {   // move to view.
        // clean this up, moving this prep to Chosen?
        // so this is refactored to add the new content only.

        gda.clearWorkingState();
        _aSlide.clearDisplay();
        gda.log(2,"slide.display from " + gda._currentSlide + " to " +  _aSlide.myId);
        //if (gda._currentSlide !== _aSlide.myId) alert("aha. not equal");
        //gda._currentSlide = _aSlide.myId;   // is this still needed ?

        // temp workaround
        if (!gda.utils.fieldExists(gda._slide().tables))
            gda._slide().tables = [];
        if (!gda._anchorEdit && gda._slide().tables.length>0) {
            gda.sEdS = gda._slide().tables[0].sChartGroup; // temp workaround
            gda.addChartGroup(gda.sEdS);
        }

        // set gda's control state up with slide specifics
        var dS = gda.activedataSource();
        //gda.editCols.csetupHiddenTableCols = dS && gda._slide().myCols[dS] ? gda._slide().myCols[dS].csetupHiddenTableCols : [];
        //gda.editCols.csetupSortTableCols = dS && gda._slide().myCols[dS] ? gda._slide().myCols[dS].csetupSortTableCols : [];
        gda.editCols.csetupHiddenTableCols = dS && gda._slide().tables[0] ? gda._slide().tables[0].csetupHiddenTableCols : [];
        gda.editCols.csetupSortTableCols = dS && gda._slide().tables[0] ? gda._slide().tables[0].csetupSortTableCols : [];
        gda.editCols.csetupChartCols = [];
        gda.bShowDataSource  = gda._slide().bShowDataSource;
        gda.bShowSlidesSource = gda._slide().bShowSlidesSource;
        gda.bPollTimer = gda._slide().bPollTimer;
        gda.bPollAggregate = gda._slide().bPollAggregate;
        gda.nPollTimerMS = gda._slide().nPollTimerMS;
        if (gda.bPollTimer && !gda.bPollTimerRunning)
            gda.manageInputSource.pollTimerStart(); // reschedule

        // probably need to add a kickoff for the poll timer

        // add dataSources used from chart definitions
        gda.setupSlideContents(gda._slide());
        // move this to Chosen, then active loads based on the sChartGroups (aka dS)?

// should this be conditional at edit time?
        gda.fileLoadImmediate (); // at 'run' time this causes multiple loads
//        gda.log(4,"slide.display: continuing after fLoadI");
// see, used to load here, which would be appropriate in Chosen just after setupSlideContents.

        gda.displayCharts();
        gda.displayTables();
        _aSlide.refreshControls();  // all
        var bDeferredDisplay = false;
    };

    _aSlide.displayPopulate = function(dSorNull) {   // fill controls, such as after file load has finished
        // for editing:
        // need 'display' for balance of slide controls (see dataComplete's showColumnChoices)

        gda.showAvailable();    // when editing, and 1+ columns are chosen "Choose Chart Data"
                                // this displays suitable choice examples, along with an 'Add' button
        gda.updateDimCharts(dSorNull);  // displays the Selector charts
        //gda.displayCharts();  //9/8/2014 readded. displayPopulate used in redraw
        gda.regenerateCharts(); // displays the Informational charts

        gda.updateChartCols(false); // default = none checked

        var s1 = document.getElementById('setupDimsCols');
        if (s1) {
            s1[gda.sTextHTML] = "";
            var dS = gda.activedataSource();
            var ds = gda.activeDatasource();
            var defV = false;
            if (gda.utils.fieldExists(gda._slide().myCols[dS]))
                defV = gda._slide().myCols[dS].csetupDimsCols; 
            if (ds)
            gda.showColumnChoices(_.difference(ds.columns,ds.trimmed), s1,'csetupDimsCols', defV, gda.colDimCheckboxChanged );
        }

        // for 'run' mode display:
        // plus the actual slide , but need auto chart generation from stored def first
        //gda.displayCharts();  //5/15/2014 remakes charts for what reason?
        if (!gda.bDashOnly)
        gda.regenerateTotalReset();

        gda.applySlideFilters();

            gda.showTable();    // does a regenerateTable internally
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

            gda.log(4,"refreshControls:");
            dHostEl[gda.sTextHTML] = "";

            if (!gda.bDashOnly) {

            var dEl = gda.addElement(dHostEl,gda.Hone);
                var dTxtT = gda.addTextNode(dEl,_aSlide.title);

            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                    var dEld = gda.addElementWithId(dEl,"div","TotalReset");
            }

            var dEl = gda.addElement(dHostEl,"div");
                dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","MyCharts");
            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","MySelectors");

            // just adds the document elements for the tables
            // could make dependent on bShowTable

    var dElTd = gda.addElementWithId(dHostEl,"div","bTable");
        dElTd.setAttribute("class","span10 offset1");
            gda.addElementWithId(dElTd,"div","FileTable");
//          var dTb = gda.addElement(dElTd,"table");
//              var dTr = gda.addElement(dTb,"tr");
//                  var dTd = gda.addElement(dTr,"td");
//                      var dEl = gda.addElement(dTd,"div");
//                      dEl.setAttribute("class","row");
//                          gda.addElementWithId(dEl,"div","FileTable");
//                  var dTd = gda.addElement(dTr,"td");
//                      var dElDT = gda.addElement(dTd,"div");
//                      dElDT.setAttribute("class","row");
//                          gda.addElementWithId(dElDT,"div","DataTable");
    var dElTd = gda.addElementWithId(dHostEl,"div","cTable");
        dElTd.setAttribute("class","span10 offset1");
            gda.addElementWithId(dElTd,"div","DataTable");

    var dElTd = gda.addElementWithId(dHostEl,"div","cfData");
        dElTd.setAttribute("class","span10");
            var dElBr = gda.addElement(dElTd,"br");
            var dTxtT = gda.addTextNode(dElTd,"Version " +gda.version+"."+gda.minor + " " + gda.branch);// + ", DOM(" + _.size(document.getElementsByTagName('*')) + ")"); // a count of all DOM elements

        if (gda && gda.cf && 1<=gda.diag) {
            var i = 0;
            if (_.size(gda.cf) === 0) {
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,(gda.sEdS ? gda.sEdS:""));
            }
            else
            _.each(gda.cf, function(dScf,dS) {
                if (i++>0) {
                    var dElBr = gda.addElement(dElTd,"br");
                        var dTxtT = gda.addTextNode(dElTd,"------------");
                }
                //var dS = dScf.dS;
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"CF(" + dS + ")"+(gda.sEdS === dS?"*":""));
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"CF(size)=" + dScf.size());  // gda.cf[dS].
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"CF(N,bitMask)=" +
                                dScf.sizem().toString(2).length + "," + dScf.sizem().toString(2) );
                    var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"CF(maxN)=" + dScf.sizeM());
            });
            if (gda.tables.length > 0 || _.size(gda._slide().tables) > 0) {
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"===tables=S=");
                i=0;
                _.each(gda._slide().tables, function(aTable) {
                    if (i++>0) {
                        var dElBr = gda.addElement(dElTd,"br");
                            var dTxtT = gda.addTextNode(dElTd,"------------");
                    }
                    var dTxtT = gda.addTextNode(dElTd,aTable.dataSource);  // gda.cf[dS].
                });
                var dElBr = gda.addElement(dElTd,"br");
                    var dTxtT = gda.addTextNode(dElTd,"===tables=D=");
                for(i = 0; i<gda.tables.length; i++) {
                    if (i++>0) {
                        var dElBr = gda.addElement(dElTd,"br");
                            var dTxtT = gda.addTextNode(dElTd,"------------");
                    }
                    var dTxtT = gda.addTextNode(dElTd,aTable.dataSource);  // gda.cf[dS].
                }
            }
        }
    };

    _aSlide.addDisplayChart = function(sChtGroup) {     // temp workaround, just adds the most recently added chart
            var docEl = document.getElementById('MyCharts');
            gda.addDisplayChart(docEl, gda.charts.length-1, gda._anchorEdit ? gda.addEditsToSelectedChart  : false);
            // would like to render just this chart
			gda.log(4,"renderALL gda.slide.addDisplayChart");
            dc.renderAll(sChtGroup);
            //gda.charts[iChart].chart.render();
    };
    _aSlide.refresh = function(sChtGroup) {
            // if editing, allow removal of a chart
            // 9/8/14 gda.displayCharts();  //5/15/2014 moved to here, generate then display, like Avail.
            var docEl = document.getElementById('MyCharts');
                docEl.setAttribute("class","container");
                //var dEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId() );
                //    dEl.setAttribute("class","row");
            gda.addDisplayCharts(docEl, sChtGroup, gda.accessOverrides() ? gda.addEditsToSelectedChart  : false);
    };
    return _aSlide;
};

gda.applySlideFilters = function(filters) {
    gda.log(4,"aSF: " + (filters ? JSON.stringify(filters) : ""));
    if (!arguments.length) filters = gda._slide().filters;  // needs to be per dataSource
        gda.log(4,"aSF: now " + JSON.stringify(filters));
        if (filters) {
            var lsChartGroups = [];
            _.each(filters, function(f,key) {
                //if (f.length>0)
                 {
                    var _aSel = _.findWhere(gda.selCharts, {"Title": key}); // hmm sChartGroup
                    if (_aSel) {
                        _aSel.chart.filterAll();
                        _.each(f, function(value) {
                            _aSel.chart.filter(value);
                        });
                        _aSel.chart.redraw();
                        lsChartGroups.push(_aSel.sChartGroup);
                    } else {
                        var _aChart = _.findWhere(gda.charts, {"Title": key}); // hmm sChartGroup
                        if (_aChart) {
                            _aChart.chart.filterAll();
                            _.each(f, function(value) {
                                _aChart.chart.filter(value);
                            });
                            _aChart.chart.redraw();
                            lsChartGroups.push(_aChart.sChartGroup);
                        }
                    }
                }
            });
            _.each(lsChartGroups, function(sChartGroup) {
                dc.redrawAll(sChartGroup);    // other charts need it
            });
        }
}

gda.showAvailable = function() {
    if (gda.sEdS && gda.cf[gda.sEdS]) { // prob needs gda.active...
        var s1 = document.getElementById('AvailChoices');
        if (s1) {
            s1.setAttribute("class","container");   // or should these just get appended (now that layout exists), and
                                                    // user can just choose one 'in place'

            gda.chooseFromAvailCharts(s1,gda.cf[gda.sEdS],gda.editCols.csetupChartCols, gda.addSelectedChart);
        }
    }
}

// creates a chart container and adds to the slide state's chart list
// needs to change to generate from the slide state's chart list
gda.addSelectedChart = function(tObj){
    var dS = gda.activedataSource();
    var aclass = tObj.class;
    var aChart = gda.newChartState(); // eventually, gda.chart(gda.newChartState());
    aChart.myCols.csetupChartCols = JSON.parse(JSON.stringify(gda.editCols.csetupChartCols)); // retain selections
    aChart.sChartGroup = dS; //sChartGroup;
    aChart.type = aclass;    // this.class
    gda._slide().charts.push(aChart);   // add to the end for now. View dependent. Could drag-n-drop eventually
    gda.addLastChart();

    gda._slide().addDisplayChart(aChart.sChartGroup);
}

gda.removeChart = function(chtId) {
    gda.log(4,"removeChart " + JSON.stringify(chtId));
    // remove from definition, then repaint.
    // or optimize and remove from active slides, and repaint just document element.

    gda._slide().charts =
        _.filter(gda._slide().charts, function(chtObj) {
            return chtObj.__dc_flag__ !== chtId;
        });
}

gda.addEditsToSelectedSelChart = function(tObj) {
    var chtId = tObj.value;
    var _aChart = _.findWhere(gda.selCharts, {"__dc_flag__": +chtId}); // or should use the doc id ?
    if (_aChart) {
		gda.addEditsToChart(_aChart, false);
        gda.updateChartCols(_aChart.cnameArray);
    }
}
gda.addEditsToSelectedChart = function(tObj) {
    var chtId = tObj.value;
    var _aChart = _.findWhere(gda.charts, {"__dc_flag__": +chtId}); // or should use the doc id ?
    if (_aChart) {
		gda.addEditsToChart(_aChart, true);
        gda.updateChartCols(_aChart.cnameArray);
    }
}

gda.addEditsToChart = function(_aChart, bAllowDel) {
	var s3 = document.getElementById(_aChart.dElid);
	if (s3 && s3.parentNode && s3.parentNode.id) {
		var s4 = document.getElementById(s3.parentNode.id+"controls");
		if (s4) {
			s4[gda.sTextHTML] = "";
            gda.addEditControls(_aChart, s4, bAllowDel);
		}
	}
}

gda.addEditControls = function(_aChart, s4, bAllowDel) {
    var dTb = gda.addElement(s4,"table");
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
            gda.addTextEntry(dTd, "Title", "Title", _aChart.Title,
                    function(newVal, fieldName) {  // adopt same form as below  .Title as a function
                    _aChart.titleCurrent(newVal);	// use for several side effects
                                _.each(gda._slide().charts, function(sChart) {
                                    if (_aChart.Title === sChart.Title)
                                        sChart.overrides = _aChart.overrides;	// update store.
                                });
                    //            gda.view.redraw();  // 8/21/2014 for override edit
                    });
            if (bAllowDel)
                gda.addButton(dTd, "deleteChart", "X", function() {      // but not for selector PieCharts
                    gda.removeSelectedChart(_aChart.__dc_flag__)
                });
            gda.addTextEntry(dTd, "dataSource", "Data Source", _aChart.sChartGroup,
                    function(newVal, fieldName) {  // adopt same form as below  .Title as a function
                    _aChart.sourceCurrent(newVal);	// use for several side effects
                                //_.each(gda._slide().charts, function(sChart) {
                                //	if (_aChart.Title === sChart.Title)
                                //		sChart.overrides = _aChart.overrides;	// update store.
                                //});
                                gda.view.redraw();  // 8/21/2014 for override edit
                    });
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
            gda.addTextEntry(dTd, "Desc", "Desc", _aChart.Desc ? _aChart.Desc : "",
                    function(newVal, fieldName) {  // adopt same form as below  .Desc as a function
                    _aChart.descCurrent(newVal);	// use for several side effects
                                _.each(gda._slide().charts, function(sChart) {
                                    if (_aChart.Title === sChart.Title)
                                        sChart.overrides = _aChart.overrides;	// update store.
                                });
                    //            gda.view.redraw();  // 8/21/2014 for override edit
                    });
        var bWidth = false;
        var bHeight = false;
        if (_aChart.overrides) {
            _.each(_aChart.overrides, function(value, key) {
                if (key === "wChart") bWidth = true;    // still used? old workaround
                if (key === "hChart") bHeight = true;
            });
        }
        if (!bWidth) {
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
            gda.addTextEntry(dTd, "wChart", "wChart", _aChart.wChart,
                    function(newVal, fieldName) {
                    //_aChart.settingCurrent("wChart",newVal);
                    gda.setOverride(_aChart,fieldName,newVal);
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
            gda.addTextEntry(dTd, "hChart", "hChart", _aChart.hChart,
                    function(newVal, fieldName) {
                    //_aChart.settingCurrent("hChart",newVal);
                        gda.setOverride(_aChart,fieldName,newVal);
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
                    gda.addTextEntry(dTd, key, key, value,
                            function(newVal, fieldName) {
                                gda.setOverride(_aChart,fieldName,newVal);

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
            gda.addTextEntry(dTd, "AddField", "Add Field", "Blank",
                    function(newField) {
                        gda.setOverride(_aChart,newField,"Blank");
                        gda.addEditsToChart(_aChart, true);
            });
}

gda.removeSelectedChart = function(chtId) {
    //gda.log(4,"removeSelectedChart? " + this.checked + " " + JSON.stringify(this));
    gda.log(4,"removeSelectedChart " + JSON.stringify(chtId));
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
//      s3[gda.sTextHTML] = "";
        gda._slide().charts =   // remove chart definition
            _.filter(gda._slide().charts, function(chtObj) {
                return chtObj.Title !== _aChart.Title;  // better name them !
            });
        gda.view.redraw();
    }
}

gda.sortTabCheckboxChanged = function(t) {
  var col = t.value;  // was this.value
  var c = t.class;
  var checked = t.checked;
  if (checked) {
    if (!gda.utils.fieldExists(gda.editCols[c]))
        gda.editCols[c] = [];
    gda.editCols[c].push(col);
  }
  else {
    gda.editCols[c] = _.without(gda.editCols[c],col);
  }
    // if editing, update the slide defaults
    if (gda._anchorEdit) {// gda.editinprogress
        var dS = gda.activedataSource();
        //gda._slide().myCols[dS].csetupSortTableCols = gda.editCols.csetupSortTableCols;
        gda._slide().tables[0].csetupSortTableCols = gda.editCols.csetupSortTableCols;
    }
  gda.regenerateTableAndDim();
}

gda.colTabCheckboxChanged = function(t) {
  var col = t.value;  // was this.value
  var c = t.class;
  var checked = t.checked;
  if (checked) {
    if (!gda.utils.fieldExists(gda.editCols[c]))
        gda.editCols[c] = [];
    gda.editCols[c].push(col);
  }
  else {
    gda.editCols[c] = _.without(gda.editCols[c],col);
  }
    // if editing, update the slide defaults
    if (gda._anchorEdit) {// gda.editinprogress
        var dS = gda.activedataSource();
        //gda._slide().myCols[dS].csetupHiddenTableCols = gda.editCols.csetupHiddenTableCols;
        gda._slide().tables[0].csetupHiddenTableCols = gda.editCols.csetupHiddenTableCols;
    }
  gda.regenerateTableAndDim();
}

gda.colDimCheckboxChanged = function(t) {
  var col = t.value;  // was this.value
  var c = t.class;
  var checked = t.checked;
  var dS = gda.activedataSource();
  if (checked) {
            var vA = null;
            if (dS && !gda.utils.fieldExists(gda._slide().myCols[dS]))
                gda._slide().myCols[dS] = {};
            vA = gda._slide().myCols[dS]; 
            if (!gda.utils.fieldExists(vA[c]))
                vA[c] = [];
            vA[c].push(col);
  }
  else {
    gda._slide().myCols[dS][c] = _.without(gda._slide().myCols[dS][c],col);
    if (gda.hasSelector(col,dS)) {
        var dS = gda.activedataSource();
        gda.removeSelector(col, dS);
    }
  }

  gda.updateDimCharts();
}
gda.joincolCheckboxChanged = function(t) {
    var col = t.value;  // was this.value
    var c = t.class;
    var checked = t.checked;
    var mS = gda.sEmS;
    var ms = gda.metaSources.map[mS];
    if (!gda.utils.fieldExists(ms.keys[c]))
        ms.keys[c] = [];
    if (checked)
        ms.keys[c].push(col);
    else
        ms.keys[c] = _.without(ms.keys[c],col);

    gda.showAvailable();
}
gda.trimcolCheckboxChanged = function(t) {
    var col = t.value;  // was this.value
    var c = t.class;
    var checked = t.checked;
    var dS = gda.sEdS;
    var ds = gda.dataSources.map[dS];   // or 'c'
    if (!gda.utils.fieldExists(ds.trimmed))
        ds.trimmed = [];
    if (checked)
        ds.trimmed.push(col);
    else
        ds.trimmed = _.without(ds.trimmed,col);
}

// this controls populating the 'available chart' choices, not the slide contents
gda.colCheckboxChanged = function(t) {
    var col = t.value;  // was this.value
    var c = t.class;
    var checked = t.checked;
    if (checked)
        gda.editCols[c].push(col);
    else
        gda.editCols[c] = _.without(gda.editCols[c],col);

    gda.showAvailable();
}

gda.updateChartCols = function(defV) {
    var s1 = document.getElementById('setupChartCols');
    if (s1) {
        s1[gda.sTextHTML] = "";

        var ds = gda.activeDatasource();
        if (ds)
        gda.showColumnChoices(_.difference(ds.columns,ds.trimmed), s1,'csetupChartCols', defV, gda.colCheckboxChanged );
    }
}

gda.updateDimCharts = function(dSorNull) {
    // all or nothing for DashOnly selectors
    if (!gda.bDashOnly) {// || (gda.utils.fieldExists(aChart.bDashInclude) && aChart.bDashInclude) 
    if (gda.allowEdit()) {
        var dS = gda.activedataSource();
        gda.updateDimChartsByDS(dS);
    }
    else
        if (dSorNull)
            gda.updateDimChartsByDS(dSorNull);
        else
        _.each(gda.activeChartGroups() , function(sChartGroup) {
            var dS = sChartGroup;
            gda.updateDimChartsByDS(dS);
        });
    gda.redrawDimCharts();
}
}

gda.updateDimChartsByDS = function(dS) {
    if (dS) {
        var mC = gda._slide().myCols[dS];
        if (mC)
            _.each(mC.csetupDimsCols, function(col,i) {
                if (!gda.hasSelector(col,dS)) {
                    //var dS = gda.activedataSource();
                    gda.newSelector(col, dS, "pieChart");
                }
            });
    }
}

gda.redrawDimCharts = function() {
    var docEl = document.getElementById('MySelectors');
    docEl[gda.sTextHTML] = "";
        docEl.setAttribute("class","container");
        var dEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId() );
            dEl.setAttribute("class","row");
    gda.addSelectorCharts(dEl, gda.accessOverrides() ? gda.addEditsToSelectedSelChart  : false);
}

gda.showFilters = function() {
    var dEl = document.getElementById('MySelectors');
    if (dEl) {
        _.each(gda.charts, function(aChart,i) {
            var c = aChart.chart;
            if (c.filter) { //c.hasFilter() { // }
                var fv = c.filters();
                var dTxtT = gda.addTextNode(dEl,aChart.Title + " : " + JSON.stringify(aChart.cnameArray) + " : " + fv); // and what is c.filters() in comparison
                var dElBr = gda.addElement(dEl,"br");
            }
        });
        _.each(gda.selCharts, function(aChart,i) {
            var c = aChart.chart;
            if (c.filter) { //c.hasFilter() { // }
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
        // should use default filters handler and addFilterHandler
        var fv = c.filters();
        if (fv.length === 0) {
            // remove empty filters. empty arrays cause some issues when slide is set up
            if (gda._slide().filters[c.gdca_chart.Title])
                delete gda._slide().filters[c.gdca_chart.Title];
            c.gdca_chart.filterEl[gda.sTextHTML] = "";
        }
        else {
        gda._slide().filters[c.gdca_chart.Title] = fv;
        if (c.gdca_chart.filterEl) {
            c.gdca_chart.filterEl[gda.sTextHTML] = "";
			var txt = gda._slide().filters[c.gdca_chart.Title];
			if (txt.length>0) {
			txt = JSON.stringify(txt);
			txt = txt.replace(/,/g,", ");
			if (txt.length === 0) txt = "-";
            //var dTxtT = gda.addTextNode(c.gdca_chart.filterEl,txt);	8/17/2014
            c.gdca_chart.filterEl[gda.sTextHTML] = txt;
			}
        }
    }
}
}

gda.regenerateTableAndDim = function(){
    var dS = gda.activedataSource();
    if (gda._slide().tables.length>0) {
        var dt = gda._slide().tables[0];
    if (!gda._anchorEdit ) dS = dt.sChartGroup;
    var ds = gda.metaSources.map[dS];   // just kludged for now. Table needs improvement after meta & dataSources
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {
    if (!gda.utils.fieldExists(dt.csetupSortTableCols))
        dt.csetupSortTableCols = [];
    if (dt.bShowTable && gda.cf[dS] && dt.csetupSortTableCols.length>0) {
        if (gda.dateDimension) {
            gda.log(4,"rTaD remove");
            gda.dateDimension.remove();
        }
        gda.dateDimension = gda.cf[dS].dimension(function (d) {
            return d[dt.csetupSortTableCols[0]]; // just first one, for now
        });
    }
    gda.regenerateTable();
    }
    }
};

// need 'table removal', and do so before redisplay
gda.regenerateTable = function() {
    var s8 = document.getElementById('DataTable');
    s8[gda.sTextHTML] = "";

    // requires a dimension for now
    var dS = gda.activedataSource();
    if (!gda._anchorEdit) dS = gda._slide().tables[0].sChartGroup;
    var ds = gda.metaSources.map[dS];   // just kludged for now. Table needs improvement after meta & dataSources
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {
        var dt = gda._slide().tables[0];
    if (!gda.utils.fieldExists(dt.csetupSortTableCols))   // gda.editCols.csetup
        dt.csetupSortTableCols = [];
    if (dt.bShowTable && gda.cf[dS] && dt.csetupSortTableCols.length>0) {

    if (!gda.utils.fieldExists(dt.csetupHiddenTableCols))
        dt.csetupHiddenTableCols = [];
    var diff = _.difference(_.difference(ds.columns,ds.trimmed), dt.csetupHiddenTableCols);
    var editCols = {};
    if (gda._anchorEdit) editCols = gda.editCols;
    else {
        editCols.csetupSortTableCols = dt.csetupSortTableCols;
        editCols.csetupHiddenTableCols = dt.csetupHiddenTableCols;
    }
    var iTable = gda.createTable(gda.cf[dS], gda.dateDimension, diff, dS, dt.bShowLinksInTable,
                                 dt.bShowPicturesInTable, JSON.parse(JSON.stringify(editCols))  );// editCols changes, need to retain state
    gda.newTableDisplay(s8,iTable);
    var chtObj=gda.tables[iTable];
    gda.addChartGroup(chtObj.sChartGroup);
    }
}
}

gda.regenerateTotalReset = function() {
    var dEl = document.getElementById('TotalReset');
    if (dEl) {
        dEl[gda.sTextHTML] = "";
        var dStr = dEl;//gda.addElement(dEl,gda.Htwo);
        _.each(gda.activeChartGroups() , function(sChartGroup,i) {
            var dEla = gda.addElement(dStr,"a");
                dEla.setAttribute("href","javascript:gda.tablesReset('"+sChartGroup+"');");
                //dEla.setAttribute("href","javascript:gda.tablesReset("+i+",gda.sChartGroups);");
                //var dStr = gda.addElement(dEla,gda.Htwo); // h3 here makes a horizontal clickable bar
                    var dTxtT = gda.addTextNode(dEla,"Reset "+sChartGroup);
            var dTxtT = gda.addTextNode(dStr," ");
        });
    }
}

gda.regenerateCharts = function() {
    var docEl = document.getElementById('MyCharts');
    gda.log(4,"regenerateC: clear,addDisplayCharts");
    //docEl[gda.sTextHTML] = "";
                var dEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId() );
                    dEl.setAttribute("class","row");
    
    if (gda.allowEdit()) {
        var dS = gda.activedataSource();
        if (dS) // could make this: if editing, then, if dS, so when editing with no dS no charts are displayed
            gda._slide().refresh(dS);
    }
    else {
        _.each(gda.activeChartGroups() , function(sChartGroup) {
            gda._slide().refresh(sChartGroup);
        });
    }
}

gda.dataComplete = function(dS) {
    if (!gda.bPolledAndViewDrawn)
        gda.bPolledAndViewDrawn = {};
    // if there are any meta sources, and this is the first trip through, (meaning, first Poll or not Polling)
    // defer the 'view updating' until after those are processed.
    if (gda.metaSources && _.size(gda.metaSources.map)>0 &&
        gda.bPolledAndViewDrawn[dS] === undefined) {    // note this affects all dS and all slide sChartGroups
        // defer. would be nice if a gda.view.show could be registered now, but awaitAll on the qR is already active.
        // for now require a 'view' in the slide file
        // except that won't work, so just call the action now
        gda.dataCompleteAction(dS);
    }
    else {
        gda.dataCompleteAction(dS);
    }
}
gda.dataCompleteAction = function(dS) {
    var ds = gda.metaSources.map[dS];
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {
    ds.bLoaded = true;
    gda.log(1,"dataCompleteAction: marked loaded, ", dS);

    if (!gda.bPollTimer || !gda.bPolledAndViewDrawn || !gda.bPolledAndViewDrawn[dS])// || !gda.bPollAggregate
    {
        //if (!gda.bPolledAndViewDrawn) {
        gda.view.redraw(dS);
        gda.bPolledAndViewDrawn[dS] = true; // should this be by dS
        //}
    }
    else {
        _.each(gda.charts, function(chtObj) {
            if (chtObj.sChartGroup === dS &&
                chtObj.chartType === "Scatter") {
                gda.scatterDomains(chtObj,false); // update
                //chtObj.chart.render();
            }
            else if (chtObj.sChartGroup === dS &&
                chtObj.chartType === "Line") {
                gda.lineDomains(chtObj,false);  // update
            }
        });
        // workaround above for Scatterplot, not updating with this?
        dc.redrawAll(dS);//sChartGroup;  // missed File Table
    }
    }
    if (gda.mySpinner) gda.mySpinner.stop();
}


// presently updates #2 and calls regenerateTable for #3
            // 1. Use Table (shown in Editor)
            // 2. Table Controls (shown when table Use is selected, edit or run).
            // 3. Table Display

// Time for table refactor, to support multiple tables (1 per DataSource for now,
// and 1 per MetaSource later, and possibly in the future any number of tables
// per source via dimension definition.
//x1. create a table prototype
//x2. restore conversion code to coerce present single table into one for the sChartGroup/dS.
// 2a. for now use a 'bUseTable' checkbox next to the Data Source radio button entry (edit only)
//     and put a 'bShowTable' somewhere.
// 3. bShowTable per Table. And one for Slide (bShowTables)
// 4. move edit and runtime checkboxes out of here?
// 5. refactor display of tables
// 6. File of Files Table, too
// 7. gda.tables for date.dimension etc
//x8. reorganize the options (edit mode) and options (run mode) stuff.
// 9. some of the testing below (gda.activeDataSource) is for edit mode only. fixed when 
//10. 'trim' columns in 'dataSource', to minimize choices and space elsewhere.
//     multiple table refactored
gda.showTable = function() {
   
    var s3 = document.getElementById('slideUseOverrides');
    if (s3) {
        s3[gda.sTextHTML] = "";
            gda.addCheckB(s3, "PollTimer", "Poll DataSource", 'objmember',
                    gda.bPollTimer, 
                    function (t) {
                        gda.log(4,"PT: " + t.checked);
                        gda.bPollTimer = t.checked;
                        if (gda.bPollTimer) {
                            gda.manageInputSource.pollTimerStart();
                            //gda.manageInputSource.pollTimerTick();  // calling this kicks one now and schedules the next
                        }
                        } );
            var dEl = gda.addElement(s3,"br");
            gda.addCheckB(s3, "PollAggregate", "Aggregate DataSource", 'objmember',
                    gda.bPollAggregate, 
                    function (t) {
                        gda.bPollAggregate = t.checked;
                        } );
            var dEl = gda.addElement(s3,"br");
        gda.addTextEntry(s3, "PollTimerMS", "PollTimerMS", gda.nPollTimerMS,
                function(newVal) {
                gda.nPollTimerMS = parseInt(newVal);
                });
        var dEl = gda.addElement(s3,"br");
        gda.addCheckB(s3, "FirstRow", "Abort Load after First 'n' Rows",//" + gda.nFirstRows + " Rows",
                'objmember',
                gda.bFirstRowsOnly, 
                function (t) {
                    if (gda.activeChartGroups().length>0) {
                    gda.bFirstRowsOnly = t.checked;
                    _.each(gda.activeChartGroups() ,function(dS) {  // gda.dataSources.map, should be for each sChartGroup? so if listed but not used...
                        var ds = gda.dataSources.map[dS];
                        ds.bLoaded = false;
                    });
                    gda.fileLoadImmediate();
                    gda.showTable();
                    }
                } );
        gda.addTextEntry(s3, "nFirstRows", ", 'n' = ", gda.nFirstRows,
                function(newVal) {
                gda.nFirstRows = parseInt(newVal);
                });
        var dEl = gda.addElement(s3,"br");
        gda.addCheckB(s3, "useOverrides", "Allow Overrides", 'objmember',
                gda._slide().bAllowOverrideChanges,// || gda.allowEdit(), 
                function (t) {
                    gda._slide().bAllowOverrideChanges = t.checked;
                    gda.view.redraw();
                } );
    }
  if (gda.allowEdit() ) {
    var s3 = document.getElementById('slideUseTable');
    if (s3 && gda.activedataSource() ) {
        s3[gda.sTextHTML] = "";
        gda.addCheckB(s3, "useTable", "Use Table", 'objmember',
                gda._slide().tables.length>0? gda._slide().tables[0].bUseTable : false, 
                function (t) {
                    if (t.checked && gda._slide().tables.length <1) {
                        gda._slide().tables.push(gda.newTableState());
                    }
                    gda._slide().tables[0].bUseTable = t.checked;
                    // need method to refresh the Nav controls when un/checked
                    gda.showTable();
                    gda.view.redraw();
                } );
        gda.addCheckB(s3, "hideShowTable", "Hide 'Show Table'", 'objmember',
                gda._slide().tables.length>0? gda._slide().tables[0].bHideShowTable : false, 
                function (t) {
                    if (t.checked && gda._slide().tables.length <1) {
                        gda._slide().tables.push(gda.newTableState());
                    }
                    gda._slide().tables[0].bHideShowTable = t.checked;
                    // need method to refresh the Nav controls when un/checked
                    gda.view.redraw();
                } );
    }
  }
        var s3 = document.getElementById('setupTable');
        if (s3) {
        s3[gda.sTextHTML] = "";
        }

    var bLocalShowTable = false;
    if (gda._slide().tables.length>0) {
      var dt = gda._slide().tables[0];
    var dS = gda.activedataSource();
    if (!gda._anchorEdit) dS = dt.sChartGroup;
    var ds = gda.metaSources.map[dS];   // just kludged for now. Table needs improvement after meta & dataSources
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {
    if (ds.columns && ds.columns.length>0) {
      if (dt.bShowTable) {
        if (!dt.bHideShowTable) {
        gda.addCheckB(s3, "showHiders", "Show Table Option Configuration", 'objmember',
                dt.bShowTableColumnSelectors, 
                function (t) {
                    dt.bShowTableColumnSelectors = t.checked;
                    gda.showTable();
                    //gda.view.redraw();    // could add, to workaround slide.next.tablechecked.notabledisplayed bug
                                            // at expense of a full redraw.
                                            // need to fix checkbox management instead
                                            // so for now, uncheck recheck to display (user).
                    } );
        }

        if (dt.bShowTableColumnSelectors ) {
      if (gda.allowEdit() ) {
            gda.addCheckB(s3, "showLinks", "Display Http as Links", 'objmember',
                    dt.bShowLinksInTable, 
                    function (t) {
                        dt.bShowLinksInTable = t.checked;
                        gda.showTable();
                        } );
            gda.addCheckB(s3, "showPictures", "Display Pictures", 'objmember',
                    dt.bShowPicturesInTable, 
                    function (t) {
                        dt.bShowPicturesInTable = t.checked;
                        gda.showTable();
                        } );
        }
            // sorting key(s)
            var dEl = gda.addElement(s3,"br");
            var dEl = gda.addElement(s3,"strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Column to Sort Table");
            var dElt = gda.addElementWithId(s3,"div","setupSortTableCols");
                gda.showColumnChoices(_.difference(ds.columns,ds.trimmed), dElt,'csetupSortTableCols', gda.editCols.csetupSortTableCols, gda.sortTabCheckboxChanged );

            // hidden columns
            //var dEl = gda.addElement(s3,"br");
            var dEl = gda.addElement(s3,"strong");
                var dTxtT = gda.addTextNode(dEl,"Choose any Columns to Hide from Table");
            var dElt = gda.addElementWithId(s3,"div","setupHiddenTableCols");
                gda.showColumnChoices(_.difference(ds.columns,ds.trimmed), dElt,'csetupHiddenTableCols', gda.editCols.csetupHiddenTableCols, gda.colTabCheckboxChanged );
        }
        bLocalShowTable = true;
    }
  }
  }
    }
    if (!gda.dateDimension)
    gda.regenerateTableAndDim(bLocalShowTable);
    else
    gda.regenerateTable(bLocalShowTable);
};

// temporary, don't expose eventually
gda.showColumnChoices = function(lgdaCols,dEl,colArrayName,defV, changedCallback) {
    if (jQuery.isArray(defV)) {
        _.each(defV, function(cname) {
        gda.addCheckB(dEl, cname, cname, colArrayName, true, changedCallback);
        });
        _.each(_.difference(lgdaCols,defV), function(cname) {
        gda.addCheckB(dEl, cname, cname, colArrayName, false, changedCallback);
        });
    }
    else
        _.each(lgdaCols, function(cname) {
        //if (jQuery.isArray(defV)) {
        //    gda.addCheckB(dEl, cname, cname, colArrayName, _.contains(defV, cname), changedCallback);
        //} else {
            gda.addCheckB(dEl, cname, cname, colArrayName, defV, changedCallback);
        //}
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
        asText: function() {
            var sl = gda.slides.list();
            var t = JSON.stringify(sl);
            t = t.replace(/},{/g,"},\r\n{");
            t = t.replace(/\[{/g,"\[\r\n{");
            t = t.replace(/}]/g,"}\r\n]");
            t = t.replace(/\",\"/g,'\", \"');
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
          if (gda.allowEdit()) {

            var dEl = gda.addElement(dHostEl,"br");

            gda.addButton(dHostEl,"insSlide", "Insert Slide", gda.view.insert);
            gda.addButton(dHostEl,"addSlide", "Append Slide", gda.view.append);

            //var dEl = gda.addElement(dHostEl,"br");

            gda.addButton(dHostEl,"clearState", "Clear Slide", gda.view.clear);
            gda.addButton(dHostEl,"delSlide", "Remove Slide", function() {gda.view.remove(gda._currentSlide);});
                var sl = gda.slides.list();
                if (sl.length === 1) { // if multislide, Refresh is shown at head of the slide list
                    gda.addButton(dHostEl,"refresh", "Refresh Slide", function(t) {
                        gda.view.redraw();
                        });
                }

            var dEl = gda.addElement(dHostEl,"br");

            // slide Title
            var doChartEl = gda.addElementWithId(dHostEl,"div","slideTitleEntry");

            var dEl = gda.addElement(dHostEl,"br");

            // one of 3 sections of table support.
            // 1. Use Table (shown in Editor)
            // 2. Table Controls (shown when table Use is selected, edit or run).
            // 3. Table Display
            var docEl = gda.addElementWithId(dHostEl,"div","slideUseTable");

            var dEl = gda.addElement(dHostEl, "strong");
                var dTxtT = gda.addTextNode(dEl,"Slide Settings");
            var docEl = gda.addElementWithId(dHostEl,"div","slideUseOverrides");

            var dEl = gda.addElement(dHostEl,gda.Htwo);
                var dTxtT = gda.addTextNode(dEl,"Column Setup");
            var dTxtT = gda.addTextNode(dHostEl,"Check to choose a column, select chart type via radio button.");   // tooltip

            var dEl = gda.addElement(dHostEl, "br");

            var dEl = gda.addElement(dHostEl, "strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Dimension Selectors");
            var dElt = gda.addElementWithId(dHostEl,"div","setupDimsCols");

            var dEl = gda.addElement(dHostEl, "strong");
                var dTxtT = gda.addTextNode(dEl,"Choose Chart Data");
            var dElt = gda.addElementWithId(dHostEl,"div","setupChartCols");

            var dEl = gda.addElement(dHostEl,"div");
            dEl.setAttribute("class","row");
                var dEld = gda.addElementWithId(dEl,"div","AvailChoices");

          }
        },

        addNavGUI: function() {
            var dHostEl = gda._anchorNav;
                dHostEl.setAttribute("class","container");

            var dElR = gda.addElement(dHostEl,"row");
            var dElS = gda.addElementWithId(dElR,"div","specialEditHeader");
                dElS.setAttribute("class","span12");
            var dElR = gda.addElement(dHostEl,"row");
            var dElS = gda.addElementWithId(dElR,"div","slideSet");
                dElS.setAttribute("class","span12");

            if (gda._slide()) {
                var dElR = gda.addElement(dHostEl,"row");
                var dElS = gda.addElementWithId(dElR,"div","slideOptionControls");
                    dElS.setAttribute("class","span12");

        var dElb = gda.addElement(dElS,"div");
            dElb.setAttribute("class","span12");
            dElb.setAttribute("class","checkbox");
                if (gda._slide().tables.length>0 && gda._slide().tables[0].bUseTable) {
                  var dt = gda._slide().tables[0];
                if (dt.bHideShowTable) {}
                else
                gda.addCheckB(dElb, "showTable", "Show Table", 'objmember', //temp, use Nav anchor to "show on Slide"
                        dt.bShowTable, //gda.bShowTable, 
                        function (t) {
                            dt.bShowTable = t.checked;
                            gda.showTable();
                        });
                }

                if (gda.allowOverrides() ) { //gda._slide().bAllowOverrideChanges
                gda.addCheckB(dElb, "accessOverrides", "Access Overrides", 'objmember',
                        gda._slide().bAccessOverrides,
                        function (t) {
                            gda._slide().bAccessOverrides = t.checked;
                            gda.view.redraw();
                        });
                }
            // dElb here may not work as expected in all cases. dElS however is outside the div and
            // causes next line. div is used for the checkbox bootstrap css.
            // move these 'display'/action options to an options object for each slide, including
            // bAllows above.
            }

            // Control location where table controls will be added
            var doChartEl = gda.addElementWithId(dHostEl,"div","setupTable");
            // temp, use Nav anchor to show on slide, until table construction software is completed.
        }
    };
}();

gda.slides = function() {
    
    gda.slideRegistry.clear();
    gda._currentSlide = 0;
    gda.log(4,"gda.slides: ready ===============================1");
    if (gda.mySpinner) gda.mySpinner.create();
    //if (gda.mySpinner) gda.mySpinner.start();

    return {
        clear: function() {
            gda.slideRegistry.clear();
            gda._currentSlide = 0;
            gda.slides.append();
        },
        open: function(slidespath) {
            if (gda.mySpinner) gda.mySpinner.start();
            gda.log(2,"click actions " + JSON.stringify(gda.clickModifiers));

            if (gda && gda.clickModifiers) {
                if (gda.clickModifiers.ctrlKey &&     // ctrl-left-shift-click on link,
                    gda.clickModifiers.shiftKey)      //  keep existing and open/add additional slides
                {                                     //  and goto first of newly opened slides
                    gda.switchToSlide = true;
                    gda.bAny = false;   // or || with above elsewhere?
                }
                else if (gda.clickModifiers.ctrlKey)  // ctrl-left-click on link,
                {                                     //  keep existing and open/add additional slides
                }                                     //  then do nothing, default behavior of 'slidesLoadImmediate'
                else if (gda.clickModifiers.shiftKey) // shift-left-click on link,
                {                                     //   keep existing and open/add selected set in new tab
                    gda.clearAllSlides();             //   but! don't have capability yet so just act like no shift
                    gda.slideRegistry.clear();
                    gda._currentSlide = 0;
                }                        
                else                                  // otherwise clear current presentation and show the new one
                {
                    gda.clearAllSlides();
                    gda.slideRegistry.clear();
                    gda.bAny = false;
                    gda._currentSlide = 0;
                }
            }

            //if (optFilters)
            //gda.log(4,"optFilters: ",JSON.stringify(optFilters));

            gda.bDashOnly = false;
            //if (optFilters) {
            //    gda.log(4,"optFilters");
            //    if (typeof(optFilters)==="string")
            //        optFilters = JSON.parse(optFilters);
            //    if (gda.utils.fieldExists(optFilters.bDashOnly))
            //        gda.bDashOnly = true;
            //}
            gda.slidesLoadImmediate(slidespath, gda.bDashOnly);    // add slidepath immediate load
            //if (optFilters) {   // if slidesLoadImmediate is retained as async then this should be above that call
            //    gda.log(4,"optFilters, gda.dH");
            //    gda.deferredHash = optFilters;
            //}
            if (gda.mySpinner) gda.mySpinner.stop();
        },
        run: function(slidespath,dElN,dElS,optFilters) {
            if (gda.mySpinner) gda.mySpinner.start();
            if (optFilters)
            gda.log(4,"optFilters: ",JSON.stringify(optFilters));

            gda._anchorEdit = null;
            if (dElN) { gda._anchorNav = dElN; }
            if (dElS) { gda._anchorSlide = dElS; }
            //gda._slidefile = slidespath;
            gda.bDashOnly = false;
            if (optFilters) {
                gda.log(4,"optFilters");
                //gda.applySlideFilters (optFilters);
                if (typeof(optFilters)==="string")
                    optFilters = JSON.parse(optFilters);
                if (gda.utils.fieldExists(optFilters.bDashOnly))
                    gda.bDashOnly = true;
            }   // this next call is async so that the GUI/caller(HTML) doesn't hang waiting for return/timeout.
                // but the async could be moved to the caller if allowed from table rc entry.
                // here it isn't necessary when called from HTML.
            if (slidespath && slidespath.length>0) {
            gda.slidesLoadImmediate(slidespath, gda.bDashOnly);    // add slidepath immediate load
            if (optFilters) {   // if slidesLoadImmediate is retained as async then this should be above that call
                gda.log(4,"optFilters, gda.dH");
                gda.deferredHash = optFilters;
            }
            }
            else {
                gda.bShowSlidesSource = true;
                gda._slide().bShowSlidesSource = true;
                gda.view.redraw();
                gda.view.redraw();  // workaround. Display not correct on first redraw
            }
            if (gda.mySpinner) gda.mySpinner.stop();
        },
        edit: function(dElC,dElN,dElS) {   // control
            if (gda.mySpinner) gda.mySpinner.start();
            gda._allowEdit = true;
            if (dElC) { gda._anchorEdit = dElC; }
            if (dElN) { gda._anchorNav = dElN; }
            if (dElS) { gda._anchorSlide = dElS; }
            if (gda.slides.list().length === 0)
                gda.view.append();
            if (gda.mySpinner) gda.mySpinner.stop();
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

            // hack!
            if (gda.utils.fieldExists(gda.switchToSlide)) {
                delete gda.switchToSlide;
                gda._currentSlide = gda.slideRegistry.list().length-1;
                //gda.view.redraw();
            }
        },
        remove: function(i) {
            gda.slideRegistry.remove(i);
        },

        ///////////////////////////////////////////////////////////////////
        // 
        ///////////////////////////////////////////////////////////////////
        createContentDataSource: function(dHostEl) {
          if (gda.allowEdit() && gda._allowDSMS) {
            var dS = gda.sEdS;
            var ds = gda.dataSources.map[dS];
            if (!ds) ds = gda.newDataSourceState();
            var dTb = gda.addElement(dHostEl,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dEl = gda.addElement(dTd,gda.Htwo);
                        var dTxtT = gda.addTextNode(dEl,"Data Source");
                        // add radio buttons for current dataSource to use
                        var dCEl = gda.addElementWithId(dTd,"div","dataProvider");
                            gda.addRadioB(dCEl, "sEdS", "new", "New", 'dSource', !gda.sEdS, 
                                function (t) {
                                    gda.sEdS = null;    // until specified and file loaded successfully
                                    gda.sEmS = null;
                                    gda.view.redraw();
                            });
                        _.each(gda.dataSources.map, function(dScf,dS) {  // was gda.cf
                            var dElBr = gda.addElement(dCEl,"br");
                            gda.addRadioB(dCEl, "sEdS", dS, dS, 'dSource', dS === gda.sEdS, 
                                function (t) {
                                    gda.sEdS = t.value === "new" ? null : t.value;
                                    gda.sEmS = null;
                                    // either create gda.activeChartGroups = gda.sChartGroups + gda.sEdS
                                    // or
                                    //gda.addChartGroup(gda.sEdS);
                                    gda.view.redraw();
                            });
                        });
                    var dTd = gda.addElement(dTr,"td");
            if (dS !== gda.sTimingDS) { // should be if the attributes exists, but workaround for now
            var dTb = gda.addElement(dTd,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","dataProviderType");
                        gda.addRadioB(dCEl, "SLFile", "SLFile", "Local File", 'objmemberSource', ds.bLocalFile, 
                                function () {
                                    gda.log(4,"as Local");
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bLocalFile = true;   // needs to be for the 'new' dS.
                                    gda.view.redraw();
                            })
                            .addRadioB(dCEl, "SHttp", "SHttp", "Http Source", 'objmemberSource', !ds.bLocalFile, 
                                function () {
                                    gda.log(4,"as Http");
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    if (dS) {
                                    }
                                    else {
                                        dS = "NameMe";
                                        gda.sEdS = dS;
                                        ds = gda.newDataSourceState();
                                        gda.dataSources.map[dS] = ds;
                                    }
                                    ds.bLocalFile = false;  // needs to be for the 'new' dS.
                                    gda.view.redraw();
                            });

                //var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var doChartEl = gda.addElementWithId(dTd,"div","dataProviderEntry");
                if (gda.utils.fieldExists(ds.bLocalFile) && !ds.bLocalFile) {
                    var dTd = gda.addElement(dTr,"td");
                        var dEla = gda.addElement(dTd,"a");
                        dEla.setAttribute("href","https://mysafeinfo.com/content/datasets");
                        dEla.setAttribute("target",'"_blank"');
                        var dTxtT = gda.addTextNode(dEla,"https://mysafeinfo.com/content/datasets" );
                }

                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","dataFileQty");
                        //var dS = gda.sEdS;
                        //var ds = gda.dataSources.map[dS];
                        gda.addRadioB(dCEl, "One", "One", "Single CSV File", 'objmember', !ds.bListOfMany, 
                                function () {
                                    gda.log(4,"newOne");
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bListOfMany = false;
                            })
                            .addRadioB(dCEl, "Many", "Many", "CSV File of File List", 'objmember', ds.bListOfMany, 
                                function () {
                                    gda.log(4,"newMany");
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bListOfMany = true;
                            });

                    var dTd = gda.addElement(dTr,"td");
                        gda.addCheckB(dTd, "aggregate", "Aggregate Data", 'objmember', ds.bAggregate, 
                                function (t) {
                                    gda.log(4,"Aggregate? " + t.checked);
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bAggregate = t.checked;
                        });
                        gda.addCheckB(dTd, "sparse", "Sparse Data", 'objmember', ds.bSparseData, 
                                function (t) {
                                    gda.log(4,"Sparse? " + t.checked);
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bSparseData = t.checked;
                        });
                        gda.addCheckB(dTd, "timestamp", "Timestamp Data", 'objmember', ds.bTimestamp, 
                                function (t) {
                                    gda.log(4,"Sparse? " + t.checked);
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    ds.bTimestamp = t.checked;
                                    if (t.checked)
                                        ds.columns = _.union(ds.columns, ["Timestamp"]);
                                    else
                                        ds.columns = _.without(ds.columns, "Timestamp");
                                    gda.view.redraw();
                        });
                if (!gda.utils.fieldExists(ds.bLocalFile) || ds.bLocalFile) {
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        gda.addUploader(dTd, "uploader");
                        var dEl = gda.addElementWithId(dTd,"span","dataFilenameDisplay");
                }

                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        gda.addCheckB(dTd, "trimcols", "Edit Trimmed Unnecessary Columns", 'objmember', gda.bEditTrimmed, 
                                function (t) {
                                    gda.bEditTrimmed = t.checked;
                                    gda.view.redraw();
                        });
                        if (gda.bEditTrimmed) {
                            var dS = gda.sEdS;
                            var ds = gda.dataSources.map[dS];
                            if (ds) {
                                if (!gda.utils.fieldExists(ds.trimmed))
                                    ds.trimmed = [];
                                var dCEl = gda.addElementWithId(dTd,"div","trimmedCols");
                                gda.showColumnChoices(ds.columns,dCEl,dS,
                                    ds.trimmed, gda.trimcolCheckboxChanged ); // www
                            }
                        }
                  }
              }
            },
        createContentMetaSource: function(dHostEl) {
          if (gda.allowEdit() && gda._allowDSMS && _.size(gda.dataSources.map)>0) {
            var mS = gda.sEmS;  // need to decide if this will refer to MetaS or DataS, think MetaS
            //if (!mS) mS = "none";
            var ms = gda.metaSources.map[mS];
            if (!ms) ms = gda.newMetaSourceState();
            var dTb = gda.addElement(dHostEl,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dEl = gda.addElement(dTd,gda.Htwo);
                        var dTxtT = gda.addTextNode(dEl,"Meta Source");
                        // add radio buttons for current dataSource to use
                        var dCEl = gda.addElementWithId(dTd,"div","metaSource");
                            gda.addRadioB(dCEl, "sEmS", "new", "New", 'dSource', !gda.sEmS, 
                                function (t) {
                                    gda.sEmS = null;    // until specified and file loaded successfully
                                    gda.sEdS = null;
                                    gda.view.redraw();
                            });
                        _.each(gda.metaSources.map, function(mSobj, mS) {  // dataSource options for meta
                            var dElBr = gda.addElement(dCEl,"br");
                            gda.addRadioB(dCEl, "sEmS", mS, mS, 'dMSource', mS === gda.sEmS, 
                                function (t) {
                                    gda.sEmS = t.value === "new" ? null : t.value;
                                    gda.sEdS = null;
                                    gda.view.redraw();
                            });
                        });
                    var dTd = gda.addElement(dTr,"td");
            var dTb = gda.addElement(dTd,"table");
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","metaProviderEntry");
                        gda.addTextEntry(dCEl, "Name", "Name", gda.sEmS,
                                function(newVal) {
                                    var mS = newVal;
                                    if (gda.metaSources.map[gda.sEmS] && gda.sEmS !== mS) {
                                        gda.metaSources.map[mS] = gda.metaSources.map[gda.sEmS];
                                        delete gda.metaSources.map[gda.sEmS];
                                    }
                                    //var ms = gda.metaSources.map[mS];
                                    gda.sEmS = mS;
				    gda.sEdS = null;	// clear the Data Source selection
                                    gda.metaSources.map[mS] = gda.newMetaSourceState();
                                    gda.view.redraw();
                        });
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","metaProviderSources");
                        var i=0;
                        _.each(gda.dataSources.map, function(dSobj, dS) {  // dataSource options for meta
                            var bInitial = gda.metaSources.map[mS] && _.contains(gda.metaSources.map[mS].dataSources, dS);
                            if (i++>0) {
                                var dElBr = gda.addElement(dCEl,"br");
                                if (ms.type === "join") {
                                var dTxtT = gda.addTextNode(dCEl,"------------");
                                var dElBr = gda.addElement(dCEl,"br");
                                }
                            }
                            gda.addCheckB(dCEl, dS, dS, 'objmember', bInitial,  // s/"sEmS"/dS
                                    function (t) {
                                        var dS = t.value;
                                        gda.log(4,"Include dS in meta? " + t.checked);
                                        if (!gda.sEmS) t.checked = false;
                                        else {
                                        var mS = gda.sEmS;
                                        var ms = gda.metaSources.map[mS];
                                        if (t.checked && !_.contains(ms.dataSources,dS)) {
                                            ms.dataSources.push(dS);
                                            //if (!gda.utils.fieldExists(ms.keys))
                                            //    ms.keys = {};
                                            //ms.keys[dS] = [];
                                        }
                                        else
                                        if (!t.checked && _.contains(ms.dataSources,dS)) {
                                            ms.dataSources = _.without(ms.dataSources, dS);
                                            if (!gda.utils.fieldExists(ms.keys))
                                                ms.keys = {};
                                            ms.keys[dS] = [];
                                        }
                                        if (ms.type === "join")
                                            gda.dataSources.updateColumns();
                                        gda.view.redraw();
                                        }
                            });
                        });
                            if (ms.type === "join") {
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","metaProviderKeys");
                        var mS = gda.sEmS;
                        var ms = gda.metaSources.map[mS];
                        i=0;
                        _.each(gda.dataSources.map, function(dSobj, dS) {  // dataSource options for meta
                            if (!gda.utils.fieldExists(ms.keys))
                                ms.keys = {};
                            if (i++>0) {
                                var dElBr = gda.addElement(dCEl,"br");
                                var dTxtT = gda.addTextNode(dCEl,"------------");
                                var dElBr = gda.addElement(dCEl,"br");
                            }
                            // add checkboxes for all available columns, with those selected checked
                            var ds = gda.dataSources.map[dS];
                            // change these two clauses up to, first add the checked items in ms.keys[dS] order, then
                            // add the remaining ds.columns in their order _.without(ds.columns,ms.keys[dS])
                            // etc
                            if (_.contains(ms.dataSources,dS)) {
                                if (ds)
                                    gda.showColumnChoices(_.without(ds.columns,ds.trimmed), dCEl,dS,
                                        ms.keys[dS], gda.joincolCheckboxChanged );
                                else
                                    var dTxtT = gda.addTextNode(dCEl,"x");
                            }
                            else
                            {
                                if (ds)
                                    gda.showColumnChoices(_.without(ds.columns,ds.trimmed), dCEl,dS,
                                        false, gda.joincolCheckboxChanged );
                                else
                                    var dTxtT = gda.addTextNode(dCEl,"o");
                            }
                        });
                        }
                // need Join option control, and then a column key (set) for each
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","metaProviderType");
                        gda.addRadioB(dCEl, "Join", "Join", "Join", 'objmemberSource', ms.type === "join", 
                                function () {
                                    gda.log(4,"join");
                                    ms.type = "join";
                                    gda.dataSources.updateColumns();
                                    gda.view.redraw();
                            })
                            .addRadioB(dCEl, "Ops", "Ops", "Ops", 'objmemberSource', ms.type === "ops", 
                                function () {
                                    gda.log(4,"ops");
                                    if (gda.sEmS) {
                                    var mS = gda.sEmS;
                                    var ms = gda.metaSources.map[mS];
                                    ms.type = "ops";
                                    gda.view.redraw();
                                    }
                            })
                            .addRadioB(dCEl, "cf", "cf", "CF", 'objmemberSource', ms.type === "cf", 
                                function () {
                                    gda.log(4,"cf");
                                    if (gda.sEmS) {
                                    var mS = gda.sEmS;
                                    var ms = gda.metaSources.map[mS];
                                    ms.type = "cf";
                                    gda.view.redraw();
                                    }
                            });
              if(1) {
                if (gda.sEmS && gda.utils.fieldExists(gda.metaSources.map[gda.sEmS])) {
                var dTr = gda.addElement(dTb,"tr");
                    var dTd = gda.addElement(dTr,"td");
                        var dCEl = gda.addElementWithId(dTd,"div","metaProviderType");
                        gda.addButton(dCEl,"Add", "Add Meta",
                                function () {
                                    gda.log(4,"add meta");
                                    //gda.metaSources.map[gda.sEmS] = gda.newMetaSourceState();
                                    gda.view.redraw();  // want to just drive the processing & refresh
                            });
                }
              }
            }
          }
    };
    gda.slides.clear(); // initialize upon first use
    gda.log(4,"gda.slides: ready ===============================2");
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
    _.each(gda.dataSources.map, function(dScf,dS) {  // was gda.cf
    });
    gda.dataSources.map = {};
};


// moving 'view' operators to here, from gda.slides
gda.view = function() {
    return {
        clear: function() {         // clears all contents from this slide. effectively delele/new/show.
            gda.log(4,"view.clear");
            gda.clearWorkingState();       // update model
            gda.view.redraw();
        },
        blipSlideIndicator: function() {
            if (gda.slideRegistry.list().length>1) {
                var docElTc = jQuery("#cslideSetcshowSlide"+gda._currentSlide);
                if (docElTc && docElTc.effect)
                    docElTc.effect( "highlight", {color: 'lightblue'}, 2000 );
            }
        },
        refocus: function() {
            // workaround for changing slides in the middle of text entry
            //$( '#'+gda.sEditPresentTextControl1 ).focus(function() {
            //  alert( "Handler for 1 .focus() called." );
            //});
            //$( '#'+gda.sEditPresentTextControl2 ).focus(function() {
            //  alert( "Handler for 2 .focus() called." );
            //});
            
            // need to first move the focus from some text entry control to another, so the edit is captured
            var docElTc = jQuery("#"+gda.sEditPresentTextControl1 );
            if (docElTc[0] === document.activeElement ) //.hasFocus())
                var docElTc = jQuery("#"+gda.sEditPresentTextControl2 );
            docElTc.focus();
         },
        remove: function() {
            gda.log(4,"view.remove");
            if (gda.slideRegistry.list().length === 1) {
                gda.slides.append();    // append new one, to replace last/current
            }
            gda.view.refocus(); // in case an edit change was made in a text control
            gda.slides.remove(gda._currentSlide);
            if (gda._currentSlide>gda.slideRegistry.list().length-1)
                gda._currentSlide = gda.slideRegistry.list().length-1;
            gda.view.showChosen();  // slide navigation occurred
        },
        insert: function() {
            gda.log(4,"view.insert");
            gda.slides.insert();
            // gda._currentSlide stays as-is.
            gda.view.redraw();  // nothing to prep, just redraw
        },
        append: function() {
            gda.log(4,"view.append");
            gda.slides.append();
            gda._currentSlide = gda.slideRegistry.list().length-1;
            gda.view.redraw();  // nothing to prep, just redraw
        },
        showPrev: function() {
            gda.view.refocus(); // in case an edit change was made in a text control
            var iPrev = gda._currentSlide-1;
            if (iPrev<0) {
                iPrev = 0;
                gda.view.blipSlideIndicator(); //redraw();
            }
            else {
                gda._currentSlide = iPrev;
                gda.view.showChosen();
            }
        },
        showNext: function() {
            gda.view.refocus(); // in case an edit change was made in a text control
            var iNext = gda._currentSlide+1;
            var sl = gda.slides.list();
            if (iNext>=sl.length) {
                iNext = sl.length-1;
                gda.view.blipSlideIndicator(); //redraw();
            }
            else {
                gda._currentSlide = iNext;
                gda.view.showChosen();
            }
        },
        showChosen: function() {    // slide navigated, time to prep and redraw
                                    // callers: showNext, showPrev, and 'Slide' buttons
                // prep requirements for the just selected slide to be drawn
                // ie, kick data loads, and unload excessive old ones
                if (gda.bPollTimer) {
                    gda.bPollTimer = false;
                    d3.timer.flush();
                    gda.bPollTimerRunning = false;
                    gda.nPollTimerExpires = +gda.nPollTimerMS;
                }

                // now draw
                gda.view.redraw();
        },
        showList: function() {          // needs renaming, or refactor below, used for slide specific control values
                                        // originally just redraw the buttons as a title/label changed
            // slide 'control palette' items
        if (gda._anchorEdit) {
            var docEl = document.getElementById('specialEditHeader');
            if (docEl) {
                docEl[gda.sTextHTML] = "";
            gda.addCheckB(docEl, "Preview", "Preview Full Slide", 'objmember',
                    !gda._allowEdit,
                    function (t) {
                        gda._allowEdit = !t.checked;
                        // need method to refresh the Nav controls when un/checked
                        gda.view.redraw();
                } );
            gda.addCheckB(docEl, "HideDS", "Hide Data/Meta Source", 'objmember',
                    !gda._allowDSMS,
                    function (t) {
                        gda._allowDSMS = !t.checked;
                        // need method to refresh subset of the (Nav,etc) controls when un/checked
                        gda.view.redraw();
                } );
            }
        }
            var docEl = document.getElementById('slideSet');
            if (docEl) {
                docEl[gda.sTextHTML] = "";

                if (gda._anchorEdit || gda.bShowSlidesSource) {
                    var dTb = gda.addElement(docEl,"table");
                        var dTr = gda.addElement(dTb,"tr");
                            var dTd = gda.addElement(dTr,"td");
                                var dEl = gda.addElement(dTd,gda.Htwo);
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
                    gda.slides.createContentMetaSource(dElD);
                }
                  
                var sl = gda.slides.list();
                if (sl.length>1) {
                    var dElBr = gda.addElement(docEl,"br");
                    var sNo = 1;
                    gda.addButton(docEl,"refresh", "Refresh Slide", function(t) {
                        gda.view.redraw();
                        });
                    //gda.addButton(docEl, "showFilters", "F", gda.applySlideFilters);
                    gda.addButton(docEl, "showSlideP", "<", function () {
                                                                gda.view.showPrev();
                    });
                    gda.addButton(docEl, "showSlideN", ">", function () {
                                                                gda.view.showNext();
                    });
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
                        var bLabel = s.title.substring(0,i);
                        sl[sNo-1].myId = sNo-1;   // workaround
                        gda.addButton(docEl, "showSlide"+(sNo-1), bLabel,
                            function(thisB) {
                                    var i = thisB.id.indexOf("showSlide");
                                    if (i>=0) {
                                        i = i + "showSlide".length;
                                        i = thisB.id.substring(i);
                                        i = +i;
                                        if (gda._currentSlide !== i) {
                                            gda._currentSlide = i;
                                            gda.view.showChosen();
                                        }
                                        else
                                            gda.view.blipSlideIndicator();
                                    }
                        });
                        sNo++;
                    });
                }
            }

            // slide specific items, poss refactor as hinted above
            var dS = gda.sEdS;          // needs gda.active... ?
            var ds = gda.dataSources.map[dS];
            if (!ds) ds = gda.newDataSourceState();
            if (gda.allowEdit() ) {
                var dElTE = document.getElementById("slideTitleEntry");
                if (dElTE) {    // prob belongs elsewhere
                    dElTE[gda.sTextHTML] = "";
                    gda.addTextEntry(dElTE, "SlideTitle", "Slide Title", gda._slide().title,
                            function(newVal) {  // adopt same form as below  .title as a function
                            gda.slides.titleCurrent(newVal); // was _name =
                            gda.view.redraw();
                            });

                    var dElDPE = document.getElementById("dataProviderEntry");
                    if (dElDPE) {
                        dElDPE[gda.sTextHTML] = "";
                        gda.addTextEntry(dElDPE, "FolderEntry", (!gda.utils.fieldExists(ds.bLocalFile) || ds.bLocalFile) ? "Folder" : "Provider", ds.dataprovider,
                                function(newVal) {
                                    var dS = gda.sEdS;
                                    var ds = gda.dataSources.map[dS];
                                    if (dS) {
                                    } else {
                                        dS = "NameMe";
                                        gda.sEdS = dS;
                                        ds = gda.newDataSourceState();
                                        gda.dataSources.map[dS] = ds;
                                    }
                                    if (!gda.utils.fieldExists(ds.bLocalFile) || ds.bLocalFile) {
                                    if (!(endsWith(newVal,"/") || endsWith(newVal,"\\")))
                                        newVal = newVal + "\\";  // preserve form?
                                    }
                                    ds.dataprovider = newVal;
                                    gda.view.redraw();
                                });
                    }
                    var dElFDE = document.getElementById("dataFilenameDisplay");
                    if (dElFDE) {
                        dElFDE[gda.sTextHTML] = "";
                        var dTxtT = gda.addTextNode(dElFDE,ds.datafile);
                        if (ds.dataLastModifiedDate)
                            var dTxtT = gda.addTextNode(dElFDE," ("+ds.dataLastModifiedDate+")");
                    }
                }
            }

            var dElFDE = document.getElementById("slideFilenameDisplay");
            if (dElFDE) {
                dElFDE[gda.sTextHTML] = "";
                var dTxtT = gda.addTextNode(dElFDE,gda._slidefile);
                if (gda._slideLastModifiedDate)
                    var dTxtT = gda.addTextNode(dElFDE," ("+gda._slideLastModifiedDate+")");
            }
        },
        //unnecessary
        //show: function(dSorNull) {
        //    gda.log(4,"view.show");
        //    gda.view.redraw(dSorNull);
        //},
// need a distinction between redrawing everything, and just the charts. The redraw implementation
// causes complete removal of charts and cf dims etc and recreates. Only the ChartTypeDisplay() needs
// to be refreshed.
        redraw: function(dSorNull) {
            gda.log(4,"view.redraw");
            if (gda._anchorEdit) {
                gda._anchorEdit[gda.sTextHTML] = "";  // call operators
                gda.Controls.addEditGUI();
          {//if (gda._allowEdit) {
                gda.slides.createContentDataSource(gda._anchorEdit);
                gda.slides.createContentMetaSource(gda._anchorEdit);
          }
            }
            if (gda._anchorNav) {
                gda._anchorNav[gda.sTextHTML] = "";
                gda.Controls.addNavGUI();
            }
            if (gda._anchorSlide) {
                //gda._anchorSlide[gda.sTextHTML] = "";

// these appear duplicative with _aSlide.display's operation.
//                gda._slide().clearDisplay();    // clear displayed contents
//                gda._slide().refreshControls(); // some standard HTML controls need forced refresh



                gda.view.showList();    // was after slide display, below
                                        //var sl = gda.slides.list();
                gda._slide().display();
                gda._slide().displayPopulate(dSorNull);
            }
            gda.view.blipSlideIndicator();
            
        },
    };
}();

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}


gda.clearWorkingState = function() {
    gda.log(1,"clearWorkingState:");
    // should this be clearing the gda.cf[dS] ? Not according to a caller
    _.each(gda.activeChartGroups() , function(dS) { // *not* every dataSource, just all chartGroups on this slide
    _.each(gda.dimensions[dS], function(dimset) {
        dimset.dDim.dispose();   // [name,dim]
    });
    gda.dimensions[dS] = [];        // working dimensions for selectors etc.
    });
    gda.sChartGroups = [];
    gda.selCols = [];           // working selection of columns for selectors, temp
    gda.selCharts = [];
    gda.selectors = [];        // definition of the selector
    gda.charts = [];                // definition of a chart
    gda.tables = [];                // definition of a tables
    //gda.slideRefs = [];
    //gda.sEdS = null;
    //gda.sEmS = null;

    if (gda.dateDimension)
        gda.dateDimension.dispose();
    gda.dateDimension = null;
    //gda.bDashOnly = false;    // should be stored in Slide, but active in gda.
                                // current slide's state
    //gda.bShowTable = false;         // show a data table ?
    gda.bShowDataSource = false;    // offset interface to choose a(nother) data file?
    gda.bShowSlidesSource = false;  // offer interface to view other slide sets?
    //gda.bFirstRowsOnly = false;   // retain state until user changes this runtime nonpersisted option
    //gda.nFirstRows = 100;         // same here.
    //gda.bSparseData = false; // workaround, until DataSource
    gda.bPollTimer = false;
    //gda.bPollTimerRunning = false;
    gda.bPollAggregate = false;
    gda.bPolledAndViewDrawn = {};
//    gda.nPollTimerMS = 5000;
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
    var sChtGroup = gda.activedataSource(); docEl.id;//"avail";   // for available charts, use the document id as the group
    if (sChtGroup) {
    // clear out earlier incarnations
    docEl[gda.sTextHTML] = "";
    //dc.deregisterAllCharts(sChtGroup);  // introduced a problem here by using dS for sChartGroup.
                                        // can't use "avail" for the chartgroup as some code is expecting
                                        // to use chartgroup for dS.

    gda.charts =
    _.filter(gda.charts, function(chtObj) {
        //if (chtObj.sChartGroup !== sChtGroup)
    //    if (gda.utils.fieldExists(chtObj.AvailChoices))
    //        dc.deregisterChart(chtObj.chart, chtObj.sChartGroup);
        return (!gda.utils.fieldExists(chtObj.AvailChoices));//chtObj.sChartGroup !== sChtGroup;
    });

    if (columns && columns.length>0) {
        if (!gda.utils.fieldExists(gda.dimensions[sChtGroup]))
            gda.dimensions[sChtGroup] = [];
        _.each(gda.availCharts, function(chartType) {
            var chtObj = gda.newChart(cf, "Choice", "", columns, sChtGroup, chartType,
                                      {"nBins":"10",
                                       "wChart":"300",
                                       "hChart":"200"});  // gda overrides
            chtObj.AvailChoices = true;
        });
        gda.addDisplayCharts(docEl,sChtGroup, callback);
    }
}
}

gda.displayTables = function() {
    gda.tables = [];
    _.each(gda._slide().tables, function(aTable) {
        gda.log(4,"dT: " + JSON.stringify(aTable));
        //if (!gda.bDashOnly || (gda.utils.fieldExists(aChart.bDashInclude) && aChart.bDashInclude)) {
        //gda.newTable(gda.cf[dS], aChart.Title, aChart.myCols.csetupChartCols, aChart.sChartGroup, aChart.type, aChart.overrides);
        //}
    });
}

gda.displayCharts = function() {
    // changed from chartgroup order to chart order
    //_.each(gda.sChartGroups, function(dS) {
        // need data to be loaded by this point, so instead of having gda.cf become an interface that hides driving
        // a load, instead drive the load of any referenced dS/mS on the current slide when it is selected?
        // The issue is the creation of the charts needs to have the data fully loaded in order to establish
        // chart limits, etc. or d3/dc errors might be driven, because we've given control of axis extents to
        // the user. Can't simply issue a renderAll or redrawAll (which
        // is incremental) as some gda work needs to happen (update some axis titles, etc at a minimum) the
        // 'fix' is to gda.view.redraw after the final data load occurs. It could be performed after each load
        // completes. A renderAll(sChartGroup=dS/mS) could occur, if the gda stuff becomes registered appropriately
        // in DC. Since it isn't yet... must brute force it.
     //   if (gda.cf[dS]) {   // during Edit, not loaded yet when called from slide.display
        gda.charts = [];    // workaround
            _.each(gda._slide().charts, function(aChart) {
                var dS = aChart.sChartGroup;
                if (gda.cf[dS]) {   // during Edit, not loaded yet when called from slide.display
                if (!gda.bDashOnly || (gda.utils.fieldExists(aChart.bDashInclude) && aChart.bDashInclude)) {
                gda.newChart(gda.cf[dS], aChart.Title, aChart.Desc, (aChart.myCols? aChart.myCols.csetupChartCols:null),
                             aChart.sChartGroup, aChart.type, aChart.overrides);
                }
                }
            });
}

gda.addLastChart = function() {
    var aChart = gda._slide().charts[gda._slide().charts.length-1];
    var dS = aChart.sChartGroup;
    if (gda.cf[dS]) {
        gda.newChart(gda.cf[dS], aChart.Title, aChart.Desc, aChart.myCols.csetupChartCols, aChart.sChartGroup, aChart.type);
    }
}

gda.dimensionByCol = function(dS,cname,cf,bFilterNonNumbers, nFixed) {
    var res;
    var aDimObj = _.findWhere(gda.dimensions[dS], {dName: cname, dFilter: bFilterNonNumbers, dFixed: nFixed});
    if (!aDimObj && cf) {
        res = cf.dimension(function (d) {
            var v = bFilterNonNumbers ? +d[cname] : d[cname];
            if (nFixed !== undefined && nFixed !== null) {
                v = v.toFixed(nFixed);
            }
            if (!bFilterNonNumbers || !isNaN(v))
            return bFilterNonNumbers ? ( (isNaN(v))?0.0:v ) : v;
            else
                return 0;
            });
        if (!gda.utils.fieldExists(gda.dimensions[dS]))
            gda.dimensions[dS] = [];
        gda.dimensions[dS].push({dName: cname, dFilter: bFilterNonNumbers, dFixed: nFixed, dDim: res})
        gda.log(4,"dBC: in " + dS + ", " + JSON.stringify(gda.dimensions[dS][gda.dimensions[dS].length-1]));
    }
    else if (aDimObj) {
        res = aDimObj.dDim;
        gda.log(4,"dBC: exists " + cname);
    }
    return res;
}

// separate model and view (creation of the objects from the view container)
gda.newSelector = function(cname, sChtGroup, chartType) {
    gda.log(4,"gda nS: " + sChtGroup + ", add " + chartType + " " + cname);
    var dS = sChtGroup;
    gda.log(4,"gda nS: " + dS + " dS");
    // might want to separate this dimension from the selector, so the
    // UI is optional to the designer
    var dDim = gda.dimensionByCol(dS, cname, gda.cf[dS]);
    if (dDim) {
    var dGrp = dDim.group();
    var selObj = new Object();
    selObj.cname = cname;
    selObj.dDim = dDim;
    selObj.dGrp = dGrp;
    selObj.chartType = chartType;
    selObj.sChartGroup = sChtGroup;
    gda.selectors.push( selObj );
    gda.selCols.push(dS+"."+cname);
    return selObj;
    }
    return null;
};

gda.hasSelector = function(cname,dS) {
    return _.contains(gda.selCols, dS+"."+cname);  // selCols can go away if selObj.cname is used
};

gda.removeSelector = function(cname, sChtGroup) {
    gda.selectors = _.filter(gda.selectors, function(selObj) { return selObj.cname !== cname || selObj.sChartGroup !== sChtGroup; });
    gda.selCols = _.filter(gda.selCols, function(selCol) { return selCol !== sChtGroup+"."+cname });
};

// view element creators
// adds new dc pieChart under dElIdBase div
gda.addSelectorCharts = function(docEl, callback) {
    var sGroups = [];
    _.each(gda.selectors, function(selObj,i) {
        var dEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId() );//i;//dElIdBase+i;   // nth view chart element
            dEl.setAttribute("class","span3");//+chtObj.overrides["span"]);
        gda.log(4,"gda aSC: _id " + dEl.id + " i col grp " + i + " " + selObj.cname + " " + selObj.sChartGroup);

        // can this assignment be eliminated?
        selObj.chart = gda.newSelectorDisplay(i, selObj.chartType, dEl, selObj.cname, selObj.dDim,selObj.dGrp,selObj.sChartGroup);

        var chtObj = gda.selCharts[i];
        // xxx yyy add chart edit controls here
        if (chtObj.chart) {
            gda.addElementWithId(dEl,"span",dEl.id+"title");
            if (gda.allowOverrides() && callback)
                gda.addRadioB(dEl, chtObj.chartType, gda.chart(chtObj).__dc_flag__, 
                                chtObj.chartType+"("+chtObj.sChartGroup.substring(0,10)+(chtObj.sChartGroup.length>10?"...":"")  +")" +
                                 (gda._anchorEdit?"": " '"+chtObj.Title.substring(0,20)+(chtObj.Title.length>20?"...":"") +"'"),
                                 chtObj.chartType, false, callback);
                gda.addElementWithId(dEl,"span",dEl.id+"controls");
        }

        if (!_.contains(sGroups,chtObj.sChartGroup))
            sGroups.push(chtObj.sChartGroup);
    });
    _.each(sGroups, function(sGroup) {
		gda.log(4,"renderALL gda.addSelectorCharts");
        dc.renderAll(sGroup);
    });
}

// adds new dc pieChart under docEl div with a new div
gda.newSelectorDisplay = function(i, chartType, docEl, cname,dDim,dGrp,sChtGroup) {
    var fn = 'newSelector'+chartType;        // function name template
    return gda.newSelectorPieChart(i, docEl,cname,dDim,dGrp,sChtGroup);        // gda.fn() or gda[fn]() ???
}

// change the embedded javascript to use this instead gda.selectorReset("+cname+","+sChtGroup+";);"
gda.selectorsReset = function(i) {
    gda.selectors[i].chart.filterAll(gda.selectors[i].sChartGroup);
    dc.redrawAll(gda.selectors[i].sChartGroup);
}

// ! charts need unique ids instead of indices, for naming and access !
gda.chartsReset = function(i,chts) {        // needs chart group too.
    gda.charts[i].chart.filterAll(gda.charts[i].sChartGroup);
    dc.redrawAll(gda.charts[i].sChartGroup);
    //gda.charts[cname].chart.filterAll(sChtGroup);
    //dc.redrawAll(sChtGroup);
}
//gda.tablesReset = function(i,sChtGroups) {        // needs chart group too.
//    dc.filterAll(sChtGroups[i]);
//	gda.log(4,"renderALL gda.tablesReset");
//    dc.renderAll(sChtGroups[i]);
//}
gda.tablesReset = function(sChartGroup) {
    dc.filterAll(sChartGroup);
    dc.renderAll(sChartGroup);
}

// adds new dc pieChart under div dEl as a new sub div
gda.newSelectorPieChart = function(i, dEl,cname,dDim, dGrp, sChtGroup) {
    var chtObj= {};
    chtObj.Title = gda.activeChartGroups().length>1 ? sChtGroup+"."+cname : cname;
    chtObj.sChartGroup = sChtGroup;
    chtObj.chartType = "Pie";// belongs elsewhere. chartType;
    chtObj.wChart = 200;    // reasonable default. Can override.
    chtObj.hChart = 200;
    gda.selCharts.push(chtObj);

    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"onFilteredChart",false);
    var dStr = gda.addElement(dEl,gda.Htwo);
        var dTitleEl = gda.addElementWithId(dStr,"div",dEl.id+dc.utils.uniqueId());
        chtObj.titleEl = dTitleEl;
    //var dEl1 = dEl;
	var dEl1 = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());

    chtObj.i = i;
    addDCdiv(dEl1, "selectors", chtObj, chtObj.Title, sChtGroup); // add div for DC chart
    gda.selCharts[i].dElid = dEl1.id;

    //var ftChart = dc.pieChart("#"+dEl.id,sChtGroup);
    var ftChart = dc.pieChart("#"+dEl1.id,sChtGroup);
    chtObj.chart = ftChart;
    ftChart.gdca_chart = chtObj;
    ftChart
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        //.width(200)
        //.height(200)
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)
        .radius(90)
        .dimension(dDim)
        .slicesCap(20)
        .group(dGrp)
        .label(gda.utils.labelFunction)
        .title(gda.utils.titleFunction)
        .renderLabel(true)
        .innerRadius(0)
        .transitionDuration(0); // ms
    if (chtObj.overrides["onFilteredChart"]) {
        var oFCname = chtObj.overrides["onFilteredChart"];
        var oFCchart = _.findWhere(gda.charts, {Title: oFCname});  // Title must be unique in a slide!
        chtObj.chart.gdca_toFilter = oFCchart;
        ftX.renderlet(function (chart) {
            if (chart.gdca_toFilter && chart.filter()) {
            gda.log(4,"period renderlet");
    // why was this being removed? ohloh ex https://www.google.com/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=renderlet%20select(%22g.y%22).style(%22display%22%2C%20%22none%22)
    //	    chart.select("g.y").style("display", "none");
            chart.gdca_toFilter.chart.filter(chart.filter());   // might already have a filter
            }
        })
        .on("filtered", function (chart) {
            if (chart.gdca_toFilter) {
            gda.log(4,"period trigger");
            dc.events.trigger(function () {
            if (chart.gdca_toFilter.chart.focus) {
                gda.log(4,"period triggered");
          // this is a test, to try to get scatter y axis to elasticY 
          // next up try reapplying the new domain to Y's axis
                chart.gdca_toFilter.chart.focus(chart.filter());
            }
            });
            }
        });
    }
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

gda.newChart = function(cf, cTitle, cDesc, cnameArray, sChtGroup, chartType, chartOverrides) {
    gda.log(4,"gda nC: " + sChtGroup + ", add '" + cTitle + "' " + chartType + " [" + cnameArray + "]" + (chartOverrides ? " overrides: " + JSON.stringify(chartOverrides):""));

    var chtObj = newBaseChart(cf, cnameArray, sChtGroup, chartType);
    chtObj.Title = cTitle;
    chtObj.Desc = cDesc;
    if (chartOverrides) { // test 8/10/2014 
		chtObj.overrides = chartOverrides;	// reference for editing, might rethink and keep at slide level
        _.each(chartOverrides, function(value, key) {
            chtObj[key] = value;
        });
	}

    var fn = 'new'+chartType+'Chart';        // function name template

    if (gda && gda[fn])
        gda[fn](chtObj, cf);

    return chtObj;
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
    chtObj.i = i;
    gda.charts.push( chtObj );
    return chtObj;
}

// xxx need to rethink sharing sChartGroup as dS, when Editing and using ChooseAvail as a sChartGroup it breaks

gda.newBoxChart = function(chtObj, cf) {
    gda.addOverride(chtObj,"boxPadding",0.8);
    gda.addOverride(chtObj,"outerPadding",0.5);
    gda.addOverride(chtObj,"boxWidth",false);
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"elasticX",true);
    gda.addOverride(chtObj,"elasticY",true);

    var xDimension = chtObj.cnameArray.length === 2 ?
        chtObj.cf.dimension(function(d) {
            var v = chtObj.cnameArray[0] + d[chtObj.cnameArray[1]];  // prefix + selector
            return v;
        }) :
        chtObj.cf.dimension(function(d) {
            var v = chtObj.cnameArray[0];
            return v;
        }) ;
    chtObj.dDims.push(xDimension);
    gda.dimensions[chtObj.sChartGroup].push({dName: ("box."+chtObj.cnameArray[0]), dFilter: true, dFixed: undefined, dDim: xDimension});

    var dBoxXGrp = chtObj.cnameArray.length === 2 ?
        xDimension.group().reduce(
            function(p,v) {
              if (v[chtObj.cnameArray[0] + v[chtObj.cnameArray[1]]])
                  p.push(+v[chtObj.cnameArray[0] + v[chtObj.cnameArray[1]]]);
              return p;
            },
            function(p,v) {
              if (v[chtObj.cnameArray[0] + v[chtObj.cnameArray[1]]])
              p.splice(p.indexOf(v[chtObj.cnameArray[0]+ v[chtObj.cnameArray[1]]]),1);
              return p;
            },
            function() {
              return [];
            }
        ) :
        xDimension.group().reduce(
            function(p,v) {
              if (v[chtObj.cnameArray[0]])
              p.push(+v[chtObj.cnameArray[0]]);
              return p;
            },
            function(p,v) {
              if (v[chtObj.cnameArray[0]])
              p.splice(p.indexOf(v[chtObj.cnameArray[0]]),1);
              return p;
            },
            function() {
              return [];
            }
        );
    
    chtObj.dGrps.push(dBoxXGrp);
}

gda.newHistChart = function(chtObj, cf) {
    if (!chtObj.nBins) chtObj.nBins = chtObj.wChart/20; // magic number
    gda.addOverride(chtObj,"elasticX",false);
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"log",false);
    gda.addOverride(chtObj,"yMin",false);
    gda.addOverride(chtObj,"xAxis ticks",6);

    var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[0],chtObj.cf,
                                        true);    // want sortable numbers (otherwise 9000 is < 10000)
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
        gda.log(4,"Hist nBins = " + chtObj.nBins);
        bExact = true;
    }

    var xhDimension = chtObj.cf.dimension(function(d) {
    var v = (isNaN(+d[chtObj.cnameArray[0]]))?0.0:+d[chtObj.cnameArray[0]];
    return v;
     });
    gda.dimensions[chtObj.sChartGroup].push({dName: ("hist."+chtObj.cnameArray[0]), dFilter: true, dFixed: undefined, dDim: xhDimension});
    gda.addOverride(chtObj,"nBins",chtObj.nBins);
    chtObj.dDims.push(xhDimension);
    var dHistXGrp = xhDimension.group().reduceCount();
    chtObj.dGrps.push(dHistXGrp);
}

gda.newYHistChart = function(chtObj, cf) {
    gda.newHistChart(chtObj,cf); // similar to X, but rotated during display
    chtObj.bChooseable = false; // YHist never...
}

gda.saDateTypes = [ "Year","Quarter","Month","Week","Day" ];
gda.isDate = function (cname) {
    var bRet = false; // need more sophisticated method, breaks ServiceInst. 
    var saDateStrings = [
        "Date","Timestamp","Year","Quarter","Month","Week","Day","_Start","_Complete" ];
    //if (cname.indexOf("date")>=0 || cname.indexOf("Date")>=0 || cname.indexOf("Year")>=0 || cname.indexOf("Quarter")>=0 || cname.indexOf("Month")>=0 || cname.indexOf("Week")>=0 || cname.indexOf("Day")===0 || cname.indexOf("Start")>=0 || cname.indexOf("_Complete")>=0 
    if (_.contains(_.map(saDateStrings, function(s) { return (cname.indexOf(s)>=0); }), true) ||
        _.contains(_.map(saDateStrings, function(s) { return (cname.toLowerCase().indexOf(s)>=0); }), true) ||
        cname==="dd") {
        bRet = true;
    }
    return bRet;
}

// start with one dimension, then expand to several (paired/triples/etc bars, or stacked).
gda.newLineChart = function(chtObj, cf) {
    gda.addOverride(chtObj,"timefield","Month");
    gda.addOverride(chtObj,"xAxisResolution","months");
    gda.addOverride(chtObj,"xAxis rotate labels",false);
    gda.addOverride(chtObj,"interpolate",false);
    gda.addOverride(chtObj,"elasticX",false);
    gda.addOverride(chtObj,"elasticY",true);
    gda.addOverride(chtObj,"log",false);
    gda.addOverride(chtObj,"yMin",false);
    if (chtObj.cnameArray.length>1) {
        gda.addOverride(chtObj,"nFixed",null);	// field, but don't use.
                                
        var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[0],chtObj.cf, true, chtObj.overrides["nFixed"]);
        if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;
        var yDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[1],chtObj.cf,true);
        chtObj.dDims.push(xDimension);
        chtObj.dDims.push(yDimension);
    var dXGrp;
    if (!xDimension.isDate)
        dXGrp = xDimension.group();//.reduceCount();
    else
     //   dXGrp = xDimension.group().reduceCount();
        dXGrp = xDimension.group().reduceSum(function(d) {
            return +d[chtObj.cnameArray[1]]; });//Count();  // 

    chtObj.dGrps.push(dXGrp);
    chtObj.lineDimension = chtObj.cf.dimension(function(d) {
        return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]]; 
    });
// "line." is matched with "series.", "scatter.",etc elsewhere
    gda.dimensions[chtObj.sChartGroup].push({dName: ("line."+chtObj.cnameArray[0]+"."+chtObj.cnameArray[1]), dFilter: true, dFixed: undefined, dDim: chtObj.lineDimension});
    chtObj.lineGroup = chtObj.lineDimension.group().reduceSum(function(d) {
            return +d[chtObj.cnameArray[1]]; });

        // 'hardwired' here for now, refactor later
        // duplicated from newTimelineChart
        if (chtObj.overrides["normalize"]) {
            var mS = chtObj.overrides["normalize"];  // grab the metaSource
            var ms = gda.metaSources.map[mS];  // grab the metaSource. refactor out the "map", or add in elsewhere, for consistency
            var cf = gda.cf[ms.dataSources[0]];
	    if (cf) {	// if source is loaded, cf will exist
            var dD = gda.dimensionByCol(ms.dataSources[0], ms.columns[0],cf);
            cf[ms.columns[0]] = dD;  // could 'name' the dimension in an object instead of numbering in an array, then add this in.
            if (chtObj.overrides["onFilteredChart"]) {
    // ???
    // at the link below ethan recommends using one crossfilter with more complicated grouping
    // instead of two crossfilters. I think a novel dependency or observer effect would help here.
    // in crossfilter itself. (if crossfilter changes from any reason (data add/sub, filters)) => notify(me)
            }
	    }
// also, to allow one pieSelector (say on BU) to adjust two crossfilters that happen to have the
// same dimension (BU, BU) of course with identical meaning, but not necessarily the same exact
// set of keys, could create a dim wrapper.
// http://stackoverflow.com/questions/24225364/apply-filter-from-one-crossfilter-dataset-to-another-crossfilter
        }
    }
}

gda.newBubbleChart = function(chtObj, cf) {
    // would also like to add: d.month = d3.time.month(d.dd); 
    // should factor out dDims to allow date specification, poss in dataSource

    if (chtObj.cnameArray.length>2) {	// for now, 0
        var xDimension = gda.dimensionByCol(
                                //chtObj.overrides["timefield"],
                                chtObj.sChartGroup,
                                chtObj.cnameArray[0],
                                chtObj.cf);
          if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;
        chtObj.dDims.push(xDimension);
	var dXGrp = xDimension.group().reduce(
                function (p, v) {
                    p[chtObj.cnameArray[1]] += +v[chtObj.cnameArray[1]];//"Raised"];
                    p[chtObj.cnameArray[2]] += +v[chtObj.cnameArray[2]];//"Deals"];
                    return p;
                },
                function (p, v) {//p.amountRaised , .deals
                    p[chtObj.cnameArray[1]] -= +v[chtObj.cnameArray[1]];//"Raised"];
                    //if (p.amountRaised < 0.001) p.amountRaised = 0; // do some clean up
                    p[chtObj.cnameArray[2]] -= +v[chtObj.cnameArray[2]];//"Deals"];
                    return p;
                },
                function () {
                    var tA = {};
                    tA[chtObj.cnameArray[2]]  = 0;
                    tA[chtObj.cnameArray[1]]  = 0;
                    return tA;//{amountRaised: 0, deals: 0};
                }
        );
	
        chtObj.dGrps.push(dXGrp); 
    }
}

gda.newFormat_NewlineChart = function(chtObj, cf) {
}

gda.newTimelineChart = function(chtObj, cf) {
    // should factor out dDims to allow date specification, poss in dataSource

    if (chtObj.cnameArray.length>1) {
        var xDimension = null;
        var dXGrp = null;
        gda.addOverride(chtObj,"elasticX",true);
        gda.addOverride(chtObj,"elasticY",true);
        gda.addOverride(chtObj,"onFilteredChart",false);  // workaround until can observe a crossfilter for filter change
        if (gda.isDate(chtObj.cnameArray[0])) {
        gda.addOverride(chtObj,"reduce",false);
        gda.addOverride(chtObj,"timefield","Month");
        gda.addOverride(chtObj,"xAxisResolution","months");
        gda.addOverride(chtObj,"normalize",false);
        gda.addOverride(chtObj,"min",false);
        gda.addOverride(chtObj,"xAxis rotate labels",false);
                                                    // or change normalization to be done in a separate dimension?

            xDimension = gda.dimensionByCol(
                                chtObj.sChartGroup,
                                chtObj.overrides["timefield"] ? chtObj.overrides["timefield"]:chtObj.cnameArray[0],
                                chtObj.cf);
            xDimension.isDate = true;

            // Temporary partial implementation of specifying reduce operators.
            // Had been hardwired up to now.
            var o = chtObj.overrides["reduce"];
            if (o) {
                                            //return gda[fn](i, docEl);
                                            // or perhaps supply some canned common reduce methods
                    if (o.indexOf(';')<0)  { // assume just a field accessor
                        var dF = new Function("d", 'return +d["' + o + '"];'); //"return +d." + o + ";");
                        //dXGrp = xDimension.group()["reduceSum"](dF);  //about the same speedwise
                        dXGrp = xDimension.group().reduceSum(dF);
                    }
                    else {
                        alert('not implemented yet');
                    }
            }
            else {
                //dXGrp = xDimension.group()["reduceCount"]();
                dXGrp = xDimension.group().reduceCount();
            }
        } else {
            xDimension = gda.dimensionByCol(
                                    chtObj.sChartGroup,
                                    chtObj.cnameArray[0],
                                    chtObj.cf);
            dXGrp = xDimension.group();//.reduceCount();
        }
        chtObj.dDims.push(xDimension);
        chtObj.dGrps.push(dXGrp); 

        // 'hardwired' here for now, refactor later
        if (chtObj.overrides["normalize"]) {
            var mS = chtObj.overrides["normalize"];  // grab the metaSource
            var ms = gda.metaSources.map[mS];  // grab the metaSource. refactor out the "map", or add in elsewhere, for consistency
            var cf = gda.cf[ms.dataSources[0]];
	    if (cf) {	// if source is loaded, cf will exist
            var dD = gda.dimensionByCol(ms.dataSources[0], ms.columns[0],cf);
            cf[ms.columns[0]] = dD;  // could 'name' the dimension in an object instead of numbering in an array, then add this in.
            if (chtObj.overrides["onFilteredChart"]) {
    // ???
    // at the link below ethan recommends using one crossfilter with more complicated grouping
    // instead of two crossfilters. I think a novel dependency or observer effect would help here.
    // in crossfilter itself. (if crossfilter changes from any reason (data add/sub, filters)) => notify(me)
            }
	    }
// also, to allow one pieSelector (say on BU) to adjust two crossfilters that happen to have the
// same dimension (BU, BU) of course with identical meaning, but not necessarily the same exact
// set of keys, could create a dim wrapper.
// http://stackoverflow.com/questions/24225364/apply-filter-from-one-crossfilter-dataset-to-another-crossfilter
        }
    }
}

gda.newSeriesChart = function(chtObj, cf) {
    if (chtObj.cnameArray.length>1) {
        chtObj.seriesDimension = chtObj.cf.dimension(function(d) { return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]]; });
    //    gda.dimensions[chtObj.sChartGroup].push({dName: ("series."+chtObj.cnameArray[0]+"."+chtObj.cnameArray[1]), dFilter: true, dFixed: undefined, dDim: chtObj.seriesDimension});
        chtObj.seriesGroup = chtObj.seriesDimension.group().reduceSum(function(d) { return +d[chtObj.cnameArray[1]]; });
    }
    //var xDimension = gda.dimensionByCol(chtObj.cnameArray[0], chtObj.cf);
    _.each(chtObj.cnameArray, function(cname,i) {
        var xDimension = gda.dimensionByCol(chtObj.sChartGroup, cname,chtObj.cf);
        chtObj.dDims.push(xDimension);
        var dXGrp = xDimension.group().reduceCount();
        chtObj.dGrps.push(dXGrp);
    });
    //if (chtObj.cnameArray.length>1)
    //    chtObj.dDims.push(gda.seriesDimension);
}

gda.newBarChart = function(chtObj, cf) {
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"log",false);
    gda.addOverride(chtObj,"yMin",false);
    gda.addOverride(chtObj,"top",false);
    var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[0],chtObj.cf);
    chtObj.dDims.push(xDimension);
    var dXGrp = xDimension.group();
    chtObj.dGrps.push(dXGrp);
}

gda.newParetoChart = function(chtObj, cf) {
    gda.newBarChart(chtObj,cf);
    gda.addOverride(chtObj,"top",false);
    // add dim for percentage
}

gda.newRowChart = function(chtObj, cf) {
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"ignoreZeroValue",false);
    gda.addOverride(chtObj,"ignoreValuesBelow",1);
    gda.addOverride(chtObj,"ignoreKey","");
    gda.addOverride(chtObj,"top",false);
    gda.addOverride(chtObj,"dropOthers",false)
    gda.addOverride(chtObj,"ordering",false)
    var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[0],chtObj.cf);
    chtObj.dDims.push(xDimension);
    var dXGrp;
    dXGrp = xDimension.group();
    chtObj.dGrps.push(dXGrp);
}

gda.newChoroplethChart = function(chtObj, cf) {
    if (chtObj.cnameArray.length>1)
    {
    gda.addOverride(chtObj,"legend",false);
    var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[1],chtObj.cf);	// 1, State, is the accessor
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

gda.newStatsChart = function(chtObj, cf) {
    var cnameArray = chtObj.cnameArray;
    if (cnameArray.length>0) {
        gda.addOverride(chtObj,"format",".2s");
        gda.addOverride(chtObj,"sigma","3");

        var xDimension = gda.dimensionByCol(chtObj.sChartGroup, cnameArray[0],chtObj.cf,true);
        chtObj.dDims.push(xDimension);

        //if (gda.isDate(chtObj.cnameArray[0]))
        //    xDimension.isDate = true;

    // scatterplot dim/grp
    if (cnameArray.length>1) {    // if 2nd attribute selected, use it for a dimension, for multiple stats sets
        chtObj.statsDimension = 
                //gda.dimensionByCol(chtObj.sChartGroup, cnameArray[1],chtObj.cf,true);
                chtObj.cf.dimension(function(d)
                ////{ return cnameArray[1]; });
                { return +d[cnameArray[1]]; });
    }
    else {
        chtObj.statsDimension = 
                //gda.dimensionByCol(chtObj.sChartGroup, cnameArray[0],chtObj.cf,true);
                chtObj.cf.dimension(function(d)
                { return cnameArray[0]; }); // aggregates filtered population
                ////{ return +d[cnameArray[0]]; };   // by unique value 'keys' (values of cnameArray[0] in d[].
    }
    gda.dimensions[chtObj.sChartGroup].push({dName: ("stats."+chtObj.cnameArray[cnameArray.length>1?1:0]), dFilter: true, dFixed: undefined, dDim: chtObj.statsDimension});
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
gda.newScatterChart = function(chtObj, cf) {
    gda.addOverride(chtObj,"legend",false);
    gda.addOverride(chtObj,"elasticX",false);//true; // not sure of this until fully tested
    gda.addOverride(chtObj,"elasticY",false);//true;
    gda.addOverride(chtObj,"brushOn",true);
    gda.addOverride(chtObj,"mouseZoomable",true);
    gda.addOverride(chtObj,"log",false);
    gda.addOverride(chtObj,"yMin",false);
    gda.addOverride(chtObj,"yMax",false);
    gda.addOverride(chtObj,"xAxis ticks",6);
    gda.addOverride(chtObj,"timefield","Month");
    gda.addOverride(chtObj,"xAxisResolution","months");
    if (chtObj.cnameArray.length>1) {
        var xDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[0],chtObj.cf,true);
        var yDimension = gda.dimensionByCol(chtObj.sChartGroup, chtObj.cnameArray[1],chtObj.cf,true);
        chtObj.dDims.push(xDimension);
        chtObj.dDims.push(yDimension);

        // would like to push this into gda.dimensionByCol
        // Seems like only ordinal only chart axis need !true for param4 of dBCol
        if (gda.isDate(chtObj.cnameArray[0]))
            xDimension.isDate = true;

    // scatterplot dim/grp
    chtObj.scatterDimension = chtObj.cf.dimension(function(d) {
       if (!isNaN(+d[chtObj.cnameArray[0]]) && !isNaN(+d[chtObj.cnameArray[1]]))
           return [+d[chtObj.cnameArray[0]], +d[chtObj.cnameArray[1]]];
    });
    // note here sChartGroup is used in place of dS.
    gda.dimensions[chtObj.sChartGroup].push({dName: ("scatter."+chtObj.cnameArray[0]+"."+chtObj.cnameArray[1]), dFilter: true, dFixed: undefined, dDim: chtObj.scatterDimension});
    chtObj.scatterGroup = chtObj.scatterDimension.group().reduceSum(function(d) { return +d[chtObj.cnameArray[1]]; });
    }
}

// eventually add a statistics display in the 4th quad.
gda.newScatterHistChart = function(chtObj, cf) {
    // these dims/grps are just for the hist section
    // refactor this out into the sub, later
    // and use a replacement container for (scatter,histX,histY,stats)
    if (chtObj.cnameArray.length>1) {

    var nBins = chtObj.wChart/20;// magic number
    if (!chtObj.nBins)
        chtObj.nBins = nBins;

    var cXChart = newBaseChart(cf, chtObj.cnameArray[0], chtObj.sChartGroup, "Hist");
    var cYChart = newBaseChart(cf, chtObj.cnameArray[1], chtObj.sChartGroup, "YHist");
    var cXStats = newBaseChart(cf, chtObj.cnameArray[0], chtObj.sChartGroup, "Stats");  // could do this for additional values
    var cYStats = newBaseChart(cf, chtObj.cnameArray[1], chtObj.sChartGroup, "Stats");
    chtObj.cXChart = cXChart;
    chtObj.cYChart = cYChart;
    chtObj.cXStats = cXStats;
    chtObj.cYStats = cYStats;
    cXChart.bChooseable = false;    // no sub charts
    cYChart.bChooseable = false;    // no sub charts
    cXStats.bChooseable = false;    // no sub charts
    cYStats.bChooseable = false;    // no sub charts
    cXChart.cnameArray = [chtObj.cnameArray[0]];        // duplicative
    cYChart.cnameArray = [chtObj.cnameArray[1]];
    cXStats.cnameArray = [chtObj.cnameArray[0]];
    cYStats.cnameArray = [chtObj.cnameArray[1]];
    cXChart.wChart = chtObj.wChart;                     
    cXChart.hChart = chtObj.hChart*3/4; // tuned
    cXChart.nBins = chtObj.nBins;
    cYChart.wChart = chtObj.hChart;
    cYChart.hChart = chtObj.wChart*3/4;
    cYChart.nBins = chtObj.nBins;

    gda.newHistChart(cXChart, cf);
    gda.newYHistChart(cYChart, cf);
    gda.newStatsChart(cXStats, cf);
    gda.newStatsChart(cYStats, cf);

    gda.newScatterChart(chtObj, cf);
    }
}

// view element creators
// adds new dc scatterPlot, twin hists,  under dElIdBase div
gda.addDisplayCharts = function(docEl,sChtGroup, callback) {
    var bSomeAdded = false;
    _.each(gda.charts, function(chtObj,i) {
        if (chtObj.sChartGroup === sChtGroup) {

            gda.addDisplayChart(docEl, i, callback);
            bSomeAdded = true;
        }
    });
    if (bSomeAdded) {
		gda.log(4,"renderALL gda.addDisplayCharts");
	   	dc.renderAll(sChtGroup);
	}
}

// non-public
gda.addDisplayChart = function(docEl, iChart, callback) {
  var   dN = docEl.childNodes.length>gda.layoutRow ? docEl.childNodes[gda.layoutRow] : docEl;

  var chtObj = gda.charts[iChart];
  if (chtObj.bChooseable === true) {

    var dTb = dN;   // docEl
    var dTr = dN;
    var dTd = dN;

    // http://getbootstrap.com/2.3.2/scaffolding.html

    var dEl = gda.addElementWithId(dN,"div",dN.id+dc.utils.uniqueId());  // docEl
    if (chtObj.overrides && chtObj.overrides["span"]) {
        dEl.setAttribute("class","span"+chtObj.overrides["span"]);
    }
        dN = dEl;
        dTd = dEl;

    if (gda._anchorEdit) {
        dTb = gda.addElement(dN,"table");
            dTr = gda.addElement(dTb,"tr");
                dTd = gda.addElement(dTr,"td");
    }

        //var dStr = gda.addElement(dTd,gda.Htwo);// perhaps consider a css element, and default to charcoal grey
            var dDescEl = gda.addElementWithId(dTd,"div",dN.id+dc.utils.uniqueId());  // docEl
            chtObj.descEl = dDescEl;
        var dFilterEl = gda.addElementWithId(dTd,"div",dN.id+dc.utils.uniqueId());
        chtObj.filterEl = dFilterEl;
        //dFilterEl.setAttribute("class","filtered")
        var doChartEl = gda.addElementWithId(dTd,"div",dN.id+dc.utils.uniqueId()); // might need to use chart title instead of uniqueId, to support 'closing' the edit.

    if (chtObj.chartType !== "ScatterHist") {
        gda.newDisplayPackaging(chtObj, doChartEl);
    }

    var bAddedChart = gda.newDisplayDispatch(iChart, chtObj.chartType, doChartEl);
    if (bAddedChart) {
        var dTitleEl = gda.addElementWithId(doChartEl,"span",doChartEl.id+"title");
        chtObj.titleEl = dTitleEl;

        if (gda.allowOverrides() && callback && chtObj.bChooseable === true) {
            gda.addRadioB(doChartEl, chtObj.chartType, gda.chart(chtObj).__dc_flag__, 
                            chtObj.chartType+"("+chtObj.sChartGroup.substring(0,10)+(chtObj.sChartGroup.length>10?"...":"")  +")" +
                             (gda._anchorEdit?"": " '"+chtObj.Title.substring(0,20)+(chtObj.Title.length>20?"...":"") +"'"),
                             chtObj.chartType, false, callback);
            gda.addElementWithId(doChartEl,"span",doChartEl.id+"controls");
        }   // brackets were missing, above element addition unnecessarily

        gda.addChartGroup(chtObj.sChartGroup);
    }
// is this going in by title function?
//        if (chtObj.titleEl && chtObj.Title) {
//            chtObj.titleEl[gda.sTextHTML] = chtObj.Title;
//        }
// convert to same method as title, using addDCdiv-like
        if (chtObj.descEl && chtObj.Desc) {
            chtObj.descEl[gda.sTextHTML] = chtObj.Desc;
        }
  }
}

gda.newSubDisplayPackaging = function(chtObj, dEl) {
    if (true) {//chtObj.bChooseable
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        chtObj.dElid = dElP.id;
        
        // these belong in an upper level, and dropped only when a composite chart element
		addDCdiv(dElP, "charts", chtObj, chtObj.cnameArray[0], chtObj.sChartGroup);   // add the DC div etc
    }
}
// included here to compare to newDCPack above
function addDrilldiv(dEl, chtObj) {
    if (chtObj.overrides["slideRef"]) {
        var dCen = gda.addElement(dEl, "center");

        var dEla = gda.addElement(dCen,"a");
                var sRef = chtObj.overrides["slideRef"];
                var slink = sRef.dataprovider + (sRef.bLocalFile ? sRef.datafile : "");
                dEla.setAttribute("href","javascript:gda.slides.open('" + slink + "');");
                    var dTxtT = gda.addTextNode(dEla," (Drill)");

        //var dElb = gda.addElement(dEl,"div");
        //dElb.setAttribute("class","clearfix");
    }
}
gda.newDisplayPackaging = function(chtObj, dEl) {
    if (chtObj.bChooseable) {
        var dElP = gda.addElementWithId(dEl,"div",dEl.id+dc.utils.uniqueId());
        chtObj.dElid = dElP.id;
        
        // these belong in an upper level, and dropped only when a composite chart element
		addDCdiv(dElP, "charts", chtObj, chtObj.Title, chtObj.sChartGroup);   // add the DC div etc
        // below used for Hist,YHist previously
        //                              cnameArray[0]

        addDrilldiv(dElP, chtObj);
    }
}

gda.newDisplayDispatch = function(i, chartType, dEl) {
    var chtObj=gda.charts[i];
    if (chtObj.bChooseable) {
    var fn = 'new'+chartType+'Display';        // function name template
        return gda[fn](chtObj, dEl); // dEl still needed for a few // chart specific setup
    }
    return false;
}

// start with one dimension, expand to more later
gda.newLineDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (dDims.length>1) {
        var cnameArray = chtObj.cnameArray;
        var cname = "";
        _.each(cnameArray, function(sCname) {
            cname = cname + ((cname.length>0) ? "," : "") + sCname;
        });

        var cd = chtObj.lineDimension;
        var gr = chtObj.lineGroup;
        if (dDims[0].isDate) {
                cd = chtObj.dDims[0];
                gr = chtObj.dGrps[0];
        }

        //gda.log(4,"add line for Line @ " + chtObj.dElid);
        var ftX = dc.lineChart("#"+chtObj.dElid,chtObj.sChartGroup)
        chtObj.chart = ftX;        // for now. hold ref
        ftX.gdca_chart = chtObj;

        gda.lineDomains(chtObj,true);

        ftX
            .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
            .width(chtObj.wChart)    // same as scatterChart
            .height(chtObj.hChart)
            .margins({top: 10, right: 50, bottom: 60, left: 60})
            .dimension(cd)
            .group(gr)
      //                      .valueAccessor(function(d){
      //                                      return d.value;
      //                                  })
            //.elasticX(false)    // so it can be focused by another chart. Should be conditional on another chart attached?
            .elasticX(chtObj.overrides["elasticX"])
            .brushOn(false);
        if (chtObj.overrides["log"] === false)
        ftX
            .elasticY(chtObj.overrides["elasticY"]);
        if (chtObj.overrides["interpolate"])
            ftX
                .interpolate(chtObj.overrides["interpolate"]);  // linear, step, basis, cardinal, etc
                                                        // https://github.com/mbostock/d3/wiki/SVG-Shapes#line_interpolate
        //if (dDims[0].isDate)
        //ftX
        //  .round(d3.time.month.round);
        //  .xAxisLabel(chtObj.cnameArray[0])
        //ftX .xAxis().ticks(d3.time.months,1);
        if (!dDims[0].isDate) {
        ftX
            .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" <= "+chtObj.numberFormat(xmax))
            .yAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[1] +" <= "+chtObj.numberFormat(ymax));
        }
        if (chtObj.overrides["normalize"]) {
                var mS = chtObj.overrides["normalize"];  // grab the metaSource
                var ms = gda.metaSources.map[mS];  // grab the metaSource. refactor out the "map", or add in elsewhere, for consistency
                var cf = gda.cf[ms.dataSources[0]];
		if (cf) { // if source loaded cf will exist
                var dD = cf[ms.columns[0]];
		var fMin = chtObj.overrides["min"] !== false ? +(chtObj.overrides["min"]) : false ;


                // need to register with crossfilter or via dc to receive filter changes that affect this cf.
                // might be able to get the desired effect by creating a fake group on the dimension and use
                // that here
            ftX
                .valueAccessor(function(d){
                        dD.filterExact(d.key);      // for this reason, it shouldn't be shared.
                        var t = dD.top(Infinity).length;    // dGrp.value()?
                        gda.log(5,"norm: "+ d.value + " " + t, t>0 ? gda.numberFormat(d.value/t) : 0, d.key);
                        dD.filterAll();             // undo the filter, at the least while shared.
			t = t>0 ? d.value/t : 0;
			if (fMin !== false && t<fMin) t = fMin;
                        return t;
                })
		}
        }
        if (chtObj.overrides["xAxis rotate labels"]) {
        ftX
        .renderlet(function(c) {
            if (c.xAxis().ticks()>9)
                c.svg().select('g').select('.axis.x').selectAll('.tick').select('text')
                    .attr("dx", "-.8em")                    // -.8
                    .attr("dy", "-.50em")    // .35          // .15
                    .attr("transform", function(d) {        // -45
                            return "rotate(-90)";
                        })
                    .style("text-anchor", "end");
        });
        }
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}

gda.newBubbleDisplay = function(chtObj) {
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

    var xs = d3.scale.ordinal();
    var xu = dc.units.ordinal();
    //var xu = dc.units.integers;
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain([xmin,xmax]);
        xu = d3.time.days;  // configurable, or automatic based on xmax-xmin?
    }

    //gda.log(4,"add series for Series @ " + chtObj.dElid);
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
	    return p.value[chtObj.cnameArray[1]];// "amountRaised"];    // 1 => 0?
	})
	.valueAccessor(function (p) {
	    return p.value[chtObj.cnameArray[2]];// "deals"];           // 2 => 1?
	})
	.radiusValueAccessor(function (p) {
        if (chtObj.cnameArray.length>2)
	    return p.value[chtObj.cnameArray[2]];// "amountRaised"];
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
		    + "Total " + chtObj.cnameArray[1] + ": " + gda.numberFormat(p.value[chtObj.cnameArray[1] ]) + "\n" 
		    + "Total " + chtObj.cnameArray[2] + ": " + gda.numberFormat(p.value[chtObj.cnameArray[2]]);
	});
    ftX
	.yAxis().tickFormat(function (s) {
	    return s;//+ " deals";
	});
    ftX
	.xAxis().tickFormat(function (s) {
	    return s;// + "M";   units
	});
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

        return true;
    }
    return false;
}


gda.newFormat_NewlineDisplay = function(chtObj) {
    var docEl = document.getElementById('MyCharts');
    gda.layoutRow++;
            var dEl = gda.addElementWithId(docEl,"div",docEl.id+dc.utils.uniqueId() );
                dEl.setAttribute("class","row");
    return true;
}

gda.newTimelineDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (dDims.length>0 && chtObj.cnameArray.length>1) {

    var ftX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup)
        .width(chtObj.wChart)
        .height(chtObj.hChart);
    ftX.stdMarginBottom = ftX.margins().bottom;
    ftX.margins().bottom = ftX.stdMarginBottom + 30;    // temp workaround. provide margin override
    // setting that in the renderlet is 'too late' ? not working.
    ftX.stdMarginLeft = ftX.margins().left;
    ftX.margins().left = ftX.stdMarginLeft + 30;    // temp workaround. provide margin override

    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;

    var v0 = null;
    var xmin = null;
    var xmax = null;

    if (!dDims[0].isDate)
    {
        v0 = chtObj.cnameArray[0];
        xmin = dDims[0].bottom(1)[0][v0];
        xmax = dDims[0].top   (1)[0][v0];
        if (isNaN(xmin)) xmin = 0;
        if (isNaN(xmax)) xmax = 0;
    } else
    {
        if(chtObj.overrides["timefield"])
        v0 = chtObj.overrides["timefield"];
        else
            v0 = chtObj.cnameArray[0];
        xmin = dDims[0].bottom(1)[0][v0];
        xmax = dDims[0].top   (1)[0][v0];
        if (xmin === undefined) xmin = new Date();
        if (xmax === undefined) {
            var Now = new Date();
            xmax = new Date(Now.getFullYear()+1,0,1);  //next year
        }
    }

    ftX
        .gap(30);

    var xu = dc.units.ordinal();
    var xe = null;  // default
    var xs = d3.scale.ordinal();
    if (dDims[0].isDate) {
        xe = d3.time.month;
        if (chtObj.overrides["timefield"]) {
            var r = chtObj.overrides["xAxisResolution"];
            var p = chtObj.overrides["timefield"].toLowerCase();
// hack, use gda.saDateTypes 
	    if (!_.contains(gda.saDateTypes,p)) {
		_.each(gda.saDateTypes, function(s) {
		    if (p.indexOf(s.toLowerCase())>=0) {
			p = s.toLowerCase();
			return;
		    }
		});
	    }
            if (p === "quarter") {
                var tInc = gda.TquarterIncMsecs;
                var d = xmax;
                var t = d.getTime();
                t = t + tInc;
                xmax = new Date(t);
                xu = d3.time.quarters;//QoY;//months;
                xe = d3.time.quarter;

                xmin = xe.floor(xmin);

                // alternative
                //xmax = d3.time.quarter.offset(xe.ceil(xmax),1);   // force xaxis to give 'space' for a quarter's time
                xmax = xe.ceil(xmax);   // force xaxis to give 'space' for a quarter's time
                // could generalize that for any time period, and start bar left edge at time start, and give a 9x% width
                // or bar gap of a few pixels.
                ftX
                    .gap(5);  // using 'gap'>0 causes #bars to be n-1, dropping last time period. dc.js ~3700 calculateBarWidth
            }
            else {
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
            }
        xu = d3.time[r]; //.months
        } else {
            xu = d3.time.months;
            xe = d3.time.month;  // at least temp switched for Almond+
            xmin = xe.floor(xmin);
            xmax = xe.ceil(xmax);
        }
        xs = d3.time.scale().domain([xmin,xmax]);
        //gda.log(4,"time scale " + xmin + " to " + xmax);
    }
    else {
        xs = d3.time.scale().domain([xmin,xmax]);   // think wrong. 'time', not.
    }

    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .dimension(dDims[0])
        .group(chtObj.dGrps[0]);
    ftX
        .centerBar(dDims[0].isDate === false);//true);  or perhaps is ordinal?
    
    ftX
        .x(xs)//.nice()
        .xUnits(xu)
        //.elasticX(true) // MIGHT NEED FALSE!
        //.elasticY(true)
        .elasticX(chtObj.overrides["elasticX"])
        .elasticY(chtObj.overrides["elasticY"])
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
        if (chtObj.overrides["normalize"]) {
                var mS = chtObj.overrides["normalize"];  // grab the metaSource
                var ms = gda.metaSources.map[mS];  // grab the metaSource. refactor out the "map", or add in elsewhere, for consistency
                var cf = gda.cf[ms.dataSources[0]];
		if (cf) { // if source loaded cf will exist
                var dD = cf[ms.columns[0]];
		var fMin = chtObj.overrides["min"] !== false ? +(chtObj.overrides["min"]) : false ;


                // need to register with crossfilter or via dc to receive filter changes that affect this cf.
                // might be able to get the desired effect by creating a fake group on the dimension and use
                // that here
            ftX
                .valueAccessor(function(d){
                        dD.filterExact(d.key);      // for this reason, it shouldn't be shared.
                        var t = dD.top(Infinity).length;    // dGrp.value()?
                        gda.log(5,"norm: "+ d.value + " " + t, t>0 ? gda.numberFormat(d.value/t) : 0, d.key);
                        dD.filterAll();             // undo the filter, at the least while shared.
			t = t>0 ? d.value/t : 0;
			if (fMin !== false && t<fMin) t = fMin;
                        return t;
                })
		}
        }
    //if (dDims[0].isDate)
    {
     //   var dR = (xmax-xmin)/1000/60/60/24;
     //   if (dR>95) 
        {
          if (dDims[0].isDate) {
              ftX
              .round(xe.round);
            }
          ftX .xAxis().ticks(xu,1);//d3.time.months,1;
        }
    }

    if (chtObj.overrides["xAxis rotate labels"]) {
    ftX // new 8/25/2014
        .renderlet(function(c) {
            //if (c.xAxis().ticks()>9)
            //var st=   
                c.svg().select('g').select('.axis.x').selectAll('.tick').select('text')
                    //;
//            c.margins().bottom = c.stdMarginBottom + 30;
// would like to _.each(st,...)
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
    }

// chart.gdca_toFilter needs to be set by user (via title) through 'Timeline' editing interface.
    // this and another chart. assume for now these two are 0,1 or 1,0
        if (chtObj.overrides["onFilteredChart"]) {
            var oFCname = chtObj.overrides["onFilteredChart"];
            var oFCchart = _.findWhere(gda.charts, {Title: oFCname});  // Title must be unique in a slide!
            chtObj.chart.gdca_toFilter = oFCchart;
            ftX.renderlet(function (chart) {
                if (chart.gdca_toFilter) {
                gda.log(4,"period renderlet");
        // why was this being removed? ohloh ex https://www.google.com/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=renderlet%20select(%22g.y%22).style(%22display%22%2C%20%22none%22)
		//	    chart.select("g.y").style("display", "none");
                if (chart.filter() && chart.filter().length>0)
			    chart.gdca_toFilter.chart.filter(chart.filter()); // need method to specify [0]
                else if (chart.gdca_toFilter.chart)
                    chart.gdca_toFilter.chart.filterAll();
                                                // possibly dropdown of charts except this one
                                                // or all charts except this one and Selectors
                }
			})
			.on("filtered", function (chart) {
                if (chart.gdca_toFilter) {
                gda.log(4,"period trigger");
			    dc.events.trigger(function () {
                if (chart.gdca_toFilter.chart.focus) {
                    gda.log(4,"period triggered");
              // this is a test, to try to get scatter y axis to elasticY 
              // next up try reapplying the new domain to Y's axis
                    _.each(gda.charts, function(lchtObj) {
                        if (lchtObj.sChartGroup === chtObj.sChartGroup &&
                            lchtObj.chartType === "Scatter") {
                            gda.scatterDomains(lchtObj,false); // update
                            //lchtObj.chart.render();
                            lchtObj.chart.redraw();
                        }
                        else if (lchtObj.sChartGroup === chtObj.sChartGroup && 
                            lchtObj.chartType === "Line") {
                            gda.lineDomains(lchtObj,false); // update
                            lchtObj.chart.redraw();
                        }
                    });
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
gda.newSeriesDisplay = function(chtObj) {
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

    var xs = d3.scale.ordinal();
    var xu = dc.units.ordinal();
    //var xu = dc.units.integers;
    if (dDims[0].isDate) {
        xs = d3.time.scale().domain([xmin,xmax]);
        xu = d3.time.days;  // configurable, or automatic based on xmax-xmin?
    }

    //gda.log(4,"add series for Series @ " + chtObj.dElid);
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
gda.newBarDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var dom = [];   // .all() is faster than .top(Infinity)
    var maxL = 0;
    chtObj.dGrps[0].top(Infinity).forEach(function(d) {
        dom[dom.length] = d.key;
        var l = d.key.length;
        if (l>maxL) maxL = l;
    });
    // assume about 5 pixels for font until can extract. Doesn't account for angle
    var botMi = maxL>0 ? (maxL-1)*5 : 0;

    //gda.log(4,"add bar for Bar @ " + chtObj.dElid);
    var ftX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup)
        .dimension(dDims[0])
        .group(chtObj.dGrps[0]);
    var maxBarHeight;
    var pixPerUnit;
    var logMin = chtObj.overrides["yMin"] ? +chtObj.overrides["yMin"] : 1.0; //{1.0;
    if (chtObj.overrides["log"]) {
        var ymax = ftX.yAxisMax();
        maxBarHeight = chtObj.hChart*.80;   // ugh. need to know the height of the text
        pixPerUnit = maxBarHeight / (Math.log(ymax)-Math.log(logMin));
        ftX.y(d3.scale.log().domain([logMin, ymax]));
    }
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
        .x(d3.scale.ordinal().domain(dom))
        .xUnits(dc.units.ordinal)
        .label(gda.utils.labelFunction)
        .title(gda.utils.titleFunction)
        //.elasticX(true)
        // brush is off, as scale needs to be corrected manually
        //.brushOn(false)
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
        });
    if (chtObj.overrides["log"]) {
        ftX
        .renderlet(function(chart) {
            chart.selectAll("g .bar")
                .attr("y", function(d) {
                    return (maxBarHeight - 1) - (pixPerUnit*(Math.log(d.y)-Math.log(logMin)));
        })
                .attr("height", function(d) {
                    return pixPerUnit*(Math.log(d.y)-Math.log(logMin));
                });
        });
    }

//    if (chtObj.overrides["top"] ) // doesn't seem to work in 1.6.99. 2.0+ perhaps.
//        ftX
//            .data(function(group) {
//                return group.top(chtObj.overrides["top"]);
//            });


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
gda.newParetoDisplay = function(chtObj) {
    //gda.newBarDisplay(chtObj); // set up the base chart, bars
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
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

        var composite = dc.compositeChart("#"+chtObj.dElid, chtObj.sChartGroup);     // need id here
        chtObj.chart = composite;
        var bc = dc.barChart(composite,chtObj.sChartGroup);
            if ( chtObj.overrides["top"] )
                bc
                    .dimension(chtObj.dDims[0].top(chtObj.overrides["top"]));
            else
                bc
                    .dimension(chtObj.dDims[0]);
        var lc = dc.lineChart(composite,chtObj.sChartGroup);
            if ( chtObj.overrides["top"] )
                lc
                    .dimension(chtObj.dDims[0].top(chtObj.overrides["top"]));
            else
                lc
                    .dimension(chtObj.dDims[0].top(Infinity));

        if ( chtObj.overrides["top"] )
                              chtObj.sChartGroup, 
            gda.pareto.domain(chtObj.sChartGroup, chtObj.dGrps[0].top(chtObj.overrides["top"]));
        else
            gda.pareto.domain(chtObj.sChartGroup, chtObj.dGrps[0].top(Infinity));

        var maxLkey = _.max(gda.pareto.getDomain(), function(key) { return key ? key.length : 0; });
        var maxL = maxLkey.length;
        // assume about 5 pixels for font until can extract. Doesn't account for angle
        var xAxisTickLabelAngle = -45;
        if (Math.abs(xAxisTickLabelAngle)<20) maxL = 0;  // apply for steeper angles
        var botMi = maxL>0 ? (maxL-1)*5 : 0;

        composite
        .margins({top: composite.margins()["top"],
                right: composite.margins()["right"],
                bottom: botMi + composite.margins()["bottom"],
                left: composite.margins()["left"]});

            bc
                
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
            .compose([
                     bc,
                   lc  //dc.lineChart(composite)
                      //.dimension(chtObj.dDims[0])
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
          //      gda.log(4,"composite renderlet");
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
        domain: function(dS, topI) { // grp {
            var all = gda.cf[dS].groupAll();


            var sum = 0;
                            // .all() is faster than .top(Infinity)
            pareto.topI = topI;// grp.top(Infinity);    // make selectable
            pareto.dom = [];
            pareto.topI.forEach(function(d) {
                // if key is a date, and one of them is a null or blank, punt it
                if (d.key && d.key !== "") {
                pareto.dom[pareto.dom.length] = d.key ? d.key.toString() : "(blank)";
                sum = sum + d.value;
                d.sum = sum;
                d.pp = 100*sum/all.value();
                }
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

gda.newRowDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (dDims.length>0) {

    gda.log(4,"rowChart " + chtObj.sChartGroup);
    var ftX = dc.rowChart("#"+chtObj.dElid,chtObj.sChartGroup)
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .ignoreZeroValue(chtObj.overrides["ignoreZeroValue"], chtObj.overrides["ignoreValuesBelow"], chtObj.overrides["ignoreKey"] ) //true,2,"" 
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        //.x(d3.scale.ordinal().domain(dom))//[xmin,xmax]    // was linear
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
        if ( chtObj.overrides["top"] )
            ftX
                .cap(chtObj.overrides["top"]);// parameterize, allow adjusting n
        if (chtObj.overrides["legend"])
            ftX
                .legend(dc.legend());

    if ( chtObj.overrides["dropOthers"] )
        ftX
         .data(function (g) {
                    return _.select(g.all(), function (e) {
                        return e.key.toLowerCase() != 'others';
                    });
                });
    if ( chtObj.overrides["ordering"] )
        ftX
         .ordering(function(d){
            return -d.value;
            });


        return true;
    }
    return false;
}

gda.newChoroplethDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (dDims.length>0) {
    var ftX = dc.geoChoroplethChart("#"+chtObj.dElid,chtObj.sChartGroup);
    chtObj.chart = ftX;        // for now. hold ref
    ftX.gdca_chart = chtObj;
    ftX.width(chtObj.wChart)//  900 //chtObj.wChart    // same as scatterChart
        .height(chtObj.hChart)	//	500 //chtObj.hChart        // not nearly as high
        .dimension(dDims[0]) //states 
        .group(chtObj.dGrps[0]); //stateRaisedSum; 

	var p = gda.utils.fieldExists( chtObj.overrides.GeoJSON) ? chtObj.overrides.GeoJSON : null;	// might want to use '.privproperties.' instead
    if (p) {    // why doesn't this work for Edit mode ?
        var ds = gda.dataSources.map[p];
        d3.json(ds.dataprovider+ds.datafile,  // need to changeup manageInputSource/etc to take callback.
		   	function( statesJson) {
				if (statesJson) {
					gda.log(4,"GeoJSON loaded, " + statesJson);
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
					}); // during Edit, ftX._groupName is undefined here.
					gda.log(4,"renderALL GeoJSON");
					dc.renderAll(chtObj.sChartGroup);   // might be overkill. chtObj.render()?
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

gda.newBoxDisplay = function(chtObj) {
    var dDims = chtObj.dDims;
    if (dDims.length>0) {
        var cnameArray = chtObj.cnameArray;                         // prob never used

    // https://stat.mq.edu.au/Stats_docs/research_papers/2004/Can_the_Box_Plot_be_Improved.pdf  quartile bars, etc.
    // http://www.jstatsoft.org/v28/c01/paper   bean plot. Perhaps a pea pod, with peas for the clusters?
    // or just add 'mode' peas, with "r" set to weighted Y, and cluster/reduce when touching/overlapping
    // for outliers, too. 'mode' peas filled and weighted "r", outliers peas as-is, except for weighted radius.
    var ftBoxX = dc.boxPlot("#"+chtObj.dElid,chtObj.sChartGroup);
    chtObj.chart = ftBoxX;        // for now. hold ref
    ftBoxX.gdca_chart = chtObj;
    ftBoxX
//        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        .margins({top: 10, right: 50, bottom: 30, left: 60})
        .elasticX(chtObj.overrides["elasticX"])
        .elasticY(chtObj.overrides["elasticY"])
        .yAxisPadding('1%') // default is 12 y units !
        .dimension(dDims[0])
        .boxPadding(chtObj.overrides["boxPadding"])
        .outerPadding(chtObj.overrides["outerPadding"])
//    .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(xmax))
        .group(chtObj.dGrps[0]);
    if (chtObj.overrides["boxWidth"] !== false)
    ftBoxX
        .boxWidth(chtObj.overrides["boxWidth"]);

//        if (dDims[0].isDate)
//            ftBoxX .xAxis().ticks(d3.time.months,6);   // months should be a setting
//        else
//            ftBoxX .xAxis().ticks(4);
  //      if (chtObj.overrides["legend"])
  //          ftBoxX
  //              .legend(dc.legend());

        return true;
    }
    return false;
}

// Hist charts use dDim(s) so a "trendline" or fitted line or another variable can be displayed as well
// HistDisplay is a standard orientation histogram using a dc.barChart
gda.newHistDisplay = function(chtObj) {
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

    var ftHistX = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup) //"#ftHistXEl",chtObj.sChartGroup
        .dimension(dDims[0])
        .group(chtObj.dGrps[0]);
    chtObj.chart = ftHistX;        // for now. hold ref
    ftHistX.gdca_chart = chtObj;

    var maxBarHeight;
    var pixPerUnit;
    var logMin = chtObj.overrides["yMin"] ? +chtObj.overrides["yMin"] : 1.0;
    if (chtObj.overrides["log"]) {
        var ymax = ftHistX.yAxisMax();
        maxBarHeight = chtObj.hChart*.88;   // ugh. need to know the height of the text
                                        // how about using the axis height in the renderlet?
        pixPerUnit = maxBarHeight / (Math.log(ymax)-Math.log(logMin));
        ftHistX.y(d3.scale.log().domain([logMin, ymax]));
    }

    ftHistX
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(chtObj.wChart)    // same as scatterChart
        .height(chtObj.hChart)        // not nearly as high
        // ScatterHist needs to un-elasticY?
        .elasticX(chtObj.overrides["elasticX"])
        //.elasticY(true)
        //.x(d3.scale.linear().domain([0,chtObj.nBins]))//.range([xmin,xmax])
        .x(d3.scale.linear().domain([xmin,xmax]))
// simplify the Hists since fp.precision exists
        .xUnits(dc.units.fp.precision((xmax-xmin)/chtObj.nBins))  // try alternative (already implemented) workaround for brush selecting right-most sample on a fp axis. Don't like it due to the 'unknown' precision where we're using arbitrary (csv) data.
        // brush is off, as scale needs to be corrected manually
        .brushOn(true)
        .centerBar(true)
        //.barPadding(0.2)  // these two don't seem to work right in 2.0
        //.gap(10)
//    .yAxisLabel("Samples per Bin")
    .xAxisLabel(chtObj.numberFormat(xmin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(xmax));
    //.xAxisLabel(xmin+" => "+ chtObj.cnameArray[0] +" (binned) <= "+xmax)

    if (chtObj.overrides["log"]) {
        ftHistX
        .renderlet(function(chart) {
            chart.selectAll("g .bar")
                .attr("y", function(d) {
                    return (maxBarHeight - 1) - (pixPerUnit*(Math.log(d.y)-Math.log(logMin)));
                })
                .attr("height", function(d) {
                    return pixPerUnit*(Math.log(d.y)-Math.log(logMin));
                });
        });
    }

        if (dDims[0].isDate)
            ftHistX .xAxis().ticks(d3.time.months,chtObj.overrides["xAxis ticks"]);   // 6 months should be a setting
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
    //gda.log(4,"xUnits " + uF(xmin, xmax) + " xmin " + xmin + " xmax " + xmax);

    ftHistX.xAxis().tickFormat( function(v,i) { 
                    var vm = (+xmax - +xmin) / uF(xmin, xmax);
                    var vr = ftHistX.xAxis().ticks() - 1;
                    var xr = ftHistX.xAxis().scale().range();
                    vr = vr / (xr[1]-xr[0]);
                    gda.log(4,"v " + +v + " i " + i + " vm " + vm + " sum " + (+xmin + (+v)*vm) );//-1 + 
                    return chtObj.numberFormat(+xmin + i*vr); });//-1 + 
}

        return true;
    }
    return false;
}

// YHistDisplay is a 90 degree CCW orientation histogram using a dc.barChart
gda.newYHistDisplay = function(chtObj) {
    var dDims = chtObj.dDims;
    if (dDims.length>0) {
    var ymin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    if (isNaN(ymin)) ymin = 0;
    var ymax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

    var ftHistY = dc.barChart("#"+chtObj.dElid,chtObj.sChartGroup);//"#ftHistYEl",chtObj.sChartGroup;
    chtObj.chart = ftHistY;        // for now. hold ref
    ftHistY.gdca_chart = chtObj;
    ftHistY
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .width(1.05*chtObj.wChart)        // adj, will be turned 90 degrees
        .height(chtObj.hChart)            // same as scatterChart
        .elasticY(true)
        // v== for rowChart
        //.y(d3.scale.linear().domain([0,chtObj.nBins+3]))//[ymin,ymax]
        .x(d3.scale.linear().domain([ymin,ymax])) //[0,chtObj.nBins]//[ymin,ymax]
        // brush is off, as scale needs to be corrected manually
        //.brushOn(false)  // not in rowChart
        .brushOn(true)
        .centerBar(true)
        .dimension(dDims[0])//yDimension
        //.useRightYAxis(true)
    //.yAxisLabel("Samples per Bin")    // not in
    .xAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[0] +" (binned) <= "+chtObj.numberFormat(ymax))
        .group(chtObj.dGrps[0])
        .renderlet(function(c) {
          gda.log(4,"YHist renderlet");
          c.svg().select('g').attr("transform","rotate(270," + (0.65*chtObj.hChart) + "," + (0.35*chtObj.wChart) + ")")});//200,172
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

gda.newStatsDisplay = function(chtObj, dEl) {
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

    chtObj.dElid = dEl0.id;
    
    var xmin = dDims[0].bottom(1)[0][chtObj.cnameArray[0]];
    var xmax = dDims[0].top   (1)[0][chtObj.cnameArray[0]];

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

gda.newScatterDisplay = function(chtObj) {
    var dDims = chtObj.dDims;

    if (chtObj.cnameArray.length>1) {

    var cnameArray = chtObj.cnameArray;
    var cname = "";
    _.each(cnameArray, function(sCname) {
        cname = cname + ((cname.length>0) ? "," : "") + sCname;
    });

// load chart setups

    var scatterChart = dc.scatterPlot("#"+chtObj.dElid, chtObj.sChartGroup )
        .width(chtObj.wChart)
        .height(chtObj.hChart)
        .dimension(chtObj.scatterDimension)
        .group(chtObj.scatterGroup);
    chtObj.chart = scatterChart;
    scatterChart.gdca_chart = chtObj;

    gda.scatterDomains(chtObj,true);

    scatterChart
        .on("filtered", function(chart, filter){ gda.showFilter(chart, filter);})
        .elasticX(chtObj.overrides["elasticX"]);   // not sure of this until fully tested
    if (chtObj.overrides["log"] === false)
    scatterChart
        .elasticY(chtObj.overrides["elasticY"]);
    scatterChart
    .mouseZoomable(chtObj.overrides["mouseZoomable"])
    .brushOn(chtObj.overrides["brushOn"])
    //.brushOn(true) // if set to false, chart can be 'zoomed', but looks like it needs elasticY then to update Y axis ticks properly. mouseZoomable.
    //.rangeChart(pnlPerDaybarChartBrush)
    //.xAxisPadding(0.11)        // fix ! hmm, percentage of full range
    //.yAxisPadding(0.11)
    .renderVerticalGridLines(true)
    .renderHorizontalGridLines(true)
    //.valueAccessor(function(d) {
    //    return d[chtObj.cnameArray[1]];
    //})
        if (chtObj.overrides["legend"])
            scatterChart
                .legend(dc.legend());

// try something similar for scatter, since Y doesn't appear to be properly elastic.
//        var currentMax = 0,
//            ratio,
//            chartMax = groupData.top(1)[0].value; // initialize with largest value
//
//        row
//          .on('postRedraw', function(chart){
//            currentMax = groupData.top(1)[0].value; // after redraw, capture largest val
//            ratio = currentMax/chartMax;
//            if(ratio < .1 || ratio > 1){ // check if bars are too small or too large
//                row.elasticX(true);
//                chartMax = currentMax; // always be sure to reset the chartMax
//                dc.redrawAll();
//            } else {
//                row.elasticX(false);
//                chartMax = currentMax;
//            }
//          });


// or it could be the initial domain setting. try updating the ydomain as needed.

        return true;
    }
    return false;
};

gda.lineDomains = function(chtObj,bInitial) {
    gda.log(3,"lineD: "+bInitial+", ",chtObj.cnameArray[0],chtObj.cnameArray[1]);
    if (!bInitial && !gda.utils.fieldExists(chtObj.chart)) return;

    var dDims = chtObj.dDims;

    // this is not a great way to get min,max, as the data may be sparse

    var b1 = dDims[0].bottom(1);
    var xmin = b1.length==0? 0 : b1[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin))
            xmin = 0;
    }
    var t1 = dDims[0].top(1);
    var xmax = t1.length==0? 0 : t1[0][chtObj.cnameArray[0]];
    gda.log(3,"lineD: xmin,xmax " + xmin + "," + xmax);

    var yb1 = dDims[1].bottom(1);
    var ymin = yb1.length==0? 0 : yb1[0][chtObj.cnameArray[1]];
    var yt1 = dDims[1].top(1);
    var ymax = yt1.length==0? 0 : yt1[0][chtObj.cnameArray[1]];
    gda.log(3,"lineD: b ymin,ymax " + ymin + "," + ymax);
    if (isNaN(ymin) || ymin==="") {
        ymin = 0;// +ymax - 0.1 * +ymax;//0; the dim[].top/bot(1)[] approach has a 'sparse' data weakness.
        ymax = +ymax + 0.1 * +ymax;//0;
    }
    else if (ymin === ymax) {
        if (ymin === 0) {
            ymin = -0.1;
            ymax = 1;
        }
        else
        {
        ymin = ymin*0.9;
        ymax = ymax*1.1;
        }
    }
    gda.log(3,"lineD: a ymin,ymax " + ymin + "," + ymax);
    // any overrides
    var yMin = chtObj.overrides["yMin"] ? +chtObj.overrides["yMin"] : 1.0;
    if (!chtObj.overrides["log"] && !chtObj.overrides["yMin"] ) yMin = ymin;

    var yMax = chtObj.overrides["yMax"] ? +chtObj.overrides["yMax"] : ymax;
    if (!chtObj.overrides["log"] && !chtObj.overrides["yMax"] ) yMax = ymax;

    var exFac = 0.03;   // expansion factor, relax ends so min/max points have some relief
                        // 10/4/2014 from 1 to 3%, make min/max points more visible against axis (partially cropped)
    var xdomain = [xmin,xmax];
    var ydomain = [yMin,yMax];//ymin,ymax];

    var xs;
    var xu;
    var ys;
    if (bInitial) {
        xs = d3.scale.ordinal();
        xu = dc.units.ordinal();
        ys = d3.scale.linear().domain(ydomain);
        if (chtObj.overrides["log"]) {
            ys = d3.scale.log().domain(ydomain);
        }
        if (dDims[0].isDate) {
            xs = d3.time.scale().domain(xdomain);
            xu = d3.time.days;
        }
    }
    else {
        xs = chtObj.chart.x();
        xu = chtObj.chart.xUnits();
        if (!chtObj.overrides["log"])
            ys = chtObj.chart.y();
    }
    if (!dDims[0].isDate) {
        xdomain = expandDomain(xdomain,exFac);
        ydomain = expandDomain(ydomain,exFac);
    }

    xs.domain(xdomain); // was d3.scale.linear().domain(xdomain)//.nice()
    if (!chtObj.overrides["log"])
        ys.domain(ydomain);

    if (bInitial) {
        chtObj.chart
            .x(xs)
            .xUnits(xu)
            .y(ys);
    }
    else
    {
        chtObj.chart
            .x(xs)
            .y(ys);
        chtObj.chart.render();//redraw();
    }
};

gda.scatterDomains = function(chtObj, bInitial){
    gda.log(3,"scatterD: "+bInitial+", ",chtObj.cnameArray[0],chtObj.cnameArray[1]);
    if (!bInitial && !gda.utils.fieldExists(chtObj.chart)) return;

    var dDims = chtObj.dDims;

    // this is not a great way to get min,max, as the data may be sparse

    var b1 = dDims[0].bottom(1);
    var xmin = b1.length==0? 0 : b1[0][chtObj.cnameArray[0]];
    if (!dDims[0].isDate)
    {
        if (isNaN(xmin))
            xmin = 0;
    }
    var t1 = dDims[0].top(1);
    var xmax = t1.length==0? 0 : t1[0][chtObj.cnameArray[0]];
    gda.log(3,"scatterD: xmin,xmax " + xmin + "," + xmax);

    var yb1 = dDims[1].bottom(1);
    var ymin = yb1.length==0? 0 : yb1[0][chtObj.cnameArray[1]];
    //var iF = 0;
    //while(isNaN(ymin) && iF<dDims[1].bottom(Infinity).length) { // not efficient!
    //    iF++;
    //    ymin = dDims[1].bottom(iF+1)[iF][chtObj.cnameArray[1]];
    //}
    var yt1 = dDims[1].top(1);
    var ymax = yt1.length==0? 0 : yt1[0][chtObj.cnameArray[1]];
    gda.log(3,"scatterD: b ymin,ymax " + ymin + "," + ymax);
    if (isNaN(ymin) || ymin==="") {
        ymin = 0;// +ymax - 0.1 * +ymax;//0; the dim[].top/bot(1)[] approach has a 'sparse' data weakness.
        ymax = +ymax + 0.1 * +ymax;//0;
    }
    else if (ymin === ymax) {
        if (ymin === 0) {
            ymin = -0.1;
            ymax = 1;
        }
        else
        {
        ymin = ymin*0.9;
        ymax = ymax*1.1;
    }
    }
    gda.log(3,"scatterD: a ymin,ymax " + ymin + "," + ymax);

    // any overrides
    var yMin = chtObj.overrides["yMin"] ? +chtObj.overrides["yMin"] : 1.0;
    if (!chtObj.overrides["log"] && !chtObj.overrides["yMin"] ) yMin = ymin;

    var yMax = chtObj.overrides["yMax"] ? +chtObj.overrides["yMax"] : ymax;
    if (!chtObj.overrides["log"] && !chtObj.overrides["yMax"] ) yMax = ymax;

    var exFac = 0.03;   // expansion factor, relax ends so min/max points have some relief
                        // 10/4/2014 from 1 to 3%, make min/max points more visible against axis (partially cropped)
    var xdomain = [xmin,xmax];
    var ydomain = [yMin,yMax];//ymin,ymax];

    var xs;
    var xu;
    var ys;
    var maxBarHeight;
    var pixPerUnit;
    if (bInitial) {
        xs = d3.scale.linear();     //var xs = d3.scale.ordinal();
        xu = dc.units.integers;//();   //var xu = dc.units.ordinal();
        ys = d3.scale.linear().domain(ydomain);
        if (chtObj.overrides["log"]) {
            maxBarHeight = chtObj.hChart*.80;   // ugh. need to know the height of the text
            pixPerUnit = maxBarHeight / (Math.log(yMax)-Math.log(yMin));
            //chtObj.chart.y(d3.scale.log().domain([yMin, yMax]));
            ys = d3.scale.log().domain([yMin, yMax]);
        }
        if (dDims[0].isDate) {
            xs = d3.time.scale().domain(xdomain);
            xu = d3.time.days;
        }
    }
    else {
        xs = chtObj.chart.x();
        xu = chtObj.chart.xUnits();
        if (!chtObj.overrides["log"])
            ys = chtObj.chart.y();
    }
    if (!dDims[0].isDate) {
        xdomain = expandDomain(xdomain,exFac);
        ydomain = expandDomain(ydomain,exFac);
    }

    xs.domain(xdomain); // was d3.scale.linear().domain(xdomain)//.nice()
    if (!chtObj.overrides["log"])
        ys.domain(ydomain);

    var xLabelFormat = chtObj.numberFormat;
    if (dDims[0].isDate) {
        xLabelFormat = gda.dateFormat;
    }
    var xl = dDims[0].isDate ?
              (xmin.toLocaleString() + " - " + xmax.toLocaleString()) :
              (xmin+" => "+ chtObj.cnameArray[0] +" <= "+xmax);
    if (bInitial) {
        if (dDims[0].isDate && chtObj.overrides["timefield"]) {
            chtObj.chart
                // needs to be keyed from the override for axis resolution
                .xAxis().ticks(d3.time.months,chtObj.overrides["xAxis ticks"]);// 6;   // add override for 6, months
        }
        else 
            if (dDims[0].isDate && chtObj.overrides["xAxisResolution"] && chtObj.overrides["xAxis ticks"]) {
                chtObj.chart
                    // the '3' or whatever doesn't have
                    // impact when elasticX is used
                    //.xAxis().ticks(d3.time.minutes,3);//chtObj.overrides["xAxis ticks"]);// 6;   // add override for 6, months
                    .xAxis().ticks(d3.time[chtObj.overrides["xAxisResolution"]],chtObj.overrides["xAxis ticks"]);
            }
        chtObj.chart
            .x(xs)
            .xUnits(xu)
            .y(ys)//.y(d3.scale.linear().domain(ydomain)) //.nice() // to use nice, need to adjust histograms
            .xAxisLabel(xl)
            //.xAxisLabel(xLabelFormat(xmin)+" => "+ chtObj.cnameArray[0] +" <= "+xLabelFormat(xmax))
            .yAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[1]  +" <= "+chtObj.numberFormat(ymax))
            .xAxis().tickFormat(function (s) {
                if (dDims[0].isDate && !chtObj.overrides["timefield"])
                    return s.toLocaleTimeString();
                else
                    return s;
            });
    }
    else
    {
    chtObj.chart
        .x(xs)
        .y(ys)
        //.y(d3.scale.linear().domain(ydomain)) //.nice() // to use nice, need to adjust histograms
        // could use a time formatter that is user specifiable.
        .xAxisLabel(xl)
        //.xAxisLabel(xLabelFormat(xmin)+" => "+ chtObj.cnameArray[0] +" <= "+xLabelFormat(xmax))
        .yAxisLabel(chtObj.numberFormat(ymin)+" => "+ chtObj.cnameArray[1]  +" <= "+chtObj.numberFormat(ymax));
    chtObj.chart.render();//redraw();
    }
};

function expandDomain(adomain, exCoef) {
    if (adomain.length===2) {
        var r = adomain[1]-adomain[0];
        var exV = r * exCoef;
        //gda.log(4,"expDom b r " + r + " exV " + exV + " ad[0],[1] " + adomain[0] + "," + adomain[1]);
        adomain[0] = +adomain[0] - exV;
        adomain[1] = +adomain[1] + exV;
        //gda.log(4,"expDom a r " + r + " exV " + exV + " ad[0],[1] " + adomain[0] + "," + adomain[1]);
    }
    return adomain;
}; 

gda.newScatterHistDisplay = function(chtObj, dEl) {
    if (chtObj.cnameArray.length>1) {

    var dTb = gda.addElement(dEl,"table");
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newDisplayPackaging(chtObj, dTd);
                gda.newScatterDisplay(chtObj);
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newSubDisplayPackaging(chtObj.cYChart, dTd);
                gda.newYHistDisplay(chtObj.cYChart);
        var dTr = gda.addElement(dTb,"tr");
            var dTd = gda.addElement(dTr,"td");
                dTd.id = dEl.id+dc.utils.uniqueId();
                gda.newSubDisplayPackaging(chtObj.cXChart, dTd);
                gda.newHistDisplay(chtObj.cXChart);
            var dTd = gda.addElement(dTr,"td");
                var dTb = gda.addElement(dTd,"table");
                    var dTr = gda.addElement(dTb,"tr");
                        var dTd = gda.addElement(dTr,"td");
                            dTd.id = dEl.id+dc.utils.uniqueId();
                            //gda.newDisplayPackaging(chtObj.cXStats, dTd);
                            gda.newStatsDisplay(chtObj.cXStats, dTd);   // still needs dTd for dEl
                        var dTd = gda.addElement(dTr,"td");
                            dTd.id = dEl.id+dc.utils.uniqueId();
                            //gda.newDisplayPackaging(chtObj.cYStats, dTd);
                            gda.newStatsDisplay(chtObj.cYStats, dTd);   // still needs dTd for dEl
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

    var dElR = gda.addElement(dEl,"row");
    var dElS = gda.addElementWithId(dElR,"div","aTable");
        //dElS.setAttribute("class","span11 offset1");

    var dEl0 = gda.addElementWithId(dElS,"div",sDcData);
        dEl0.setAttribute("class","row");

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

    //gda.log(4,"add table @ " + sDcData);//chtObj.dElid;

    dc.dataCount(".dc-"+sDcData+"-count", chtObj.sChartGroup)
    .dimension(chtObj.cf)
    .group(chtObj.cf.groupAll())
    .render();

    var selCols = null;
    if (gda._anchorEdit)
        selCols = gda.editCols;
    else
        selCols = chtObj.selCols;

    var sC = selCols.csetupSortTableCols;
    if (sC && sC.length>0) {
    gda.log(4,"cT: sorting by "); 
    (sC && sC.length>0) ? gda.log(4," col " + sC[0]) :gda.log(4," by date d.dd");
    //(chtObj.selCols && chtObj.selCols.csetupChartCols && chtObj.selCols.csetupChartCols.length>1) ? gda.log(4,"col " + chtObj.selCols.csetupChartCols[chtObj.selCols.csetupChartCols.length-1]) :gda.log(4,"by date d.dd");
    var ftT = dc.dataTable(".dc-"+sDcData+"-table", chtObj.sChartGroup)
    // dDims[0] sets the table macro sort order. .sort specifies the order within groups
    .dimension(chtObj.dDims[0])//dateDim        // cf2 might balk at null here
      .group(
            (sC.length >0  ?
        function (d) {   // make this an override
        var format = d3.format("02d");
        var r = 1;
        if (d && d[ sC[0] ] && gda.isDate(sC[0]) ){
        //gda.log(4,"d.dd " + d.dd);
        r = d[sC[0]].getFullYear() + "/" + format((d[sC[0]].getMonth() + 1));
        }
        return r;
        } :
        gda.dateDimension))
    .size(500)  // arbitrary. make selectable
    .columns(chtObj.colAccessor)
    // sorts by available date first unless 2+ columns are chosen, then uses the last chosen, within the date grouper
    //.sortBy(function (d) { return (chtObj.selCols && chtObj.selCols.csetupChartCols && chtObj.selCols.csetupChartCols.length>1) ?+d[chtObj.selCols.csetupChartCols[chtObj.selCols.csetupChartCols.length-1]]:d.dd; })
      .sortBy(function (d) { return (sC && sC.length>0) ?+d[sC[0]]:d.dd; })
    .order(d3.descending)
    .render();
  //  .sortValues(function(a,b) {
  //      return b - a;
  //    });
//    .renderlet(function (table) {
//        table.selectAll(".dc-table-group").classed("info", true);
//    });


//    dc.renderAll(sGroup);
    }
}

// create a table object						note myCols is temporary. sorted by date unless myCols>=2 and uses [1].
                                                // remove sDCData Table,Count later
gda.createTable = function(cf, dateDim, columns, sChtGroup, bShowLinksInTable, bShowPicturesInTable, selCols) {
    var chtObj = new Object();
    chtObj.cnameArray = columns;        // one per 'series' in the chart, often just 1 or 2.
                                    // establishes the dimensionality or series size of the chart
    //chtObj.chartType = chartType; // not yet. just one table type
    chtObj.cf = cf;
    chtObj.sChartGroup = sChtGroup; // both temporarily
    chtObj.dataSource = sChtGroup;
    chtObj.dDims = [dateDim]; // one per 'series' in the chart, often just 1 or 2.
    chtObj.numberFormat = gda.numberFormat; // default for unspecified columns
    chtObj.selCols = selCols;       // such as this one... ? need to design*1
// design*1 method to save 'choices' and have this reference that copy of 'choices'. Shared right now.
    var iTable = gda.tables.length;
    gda.tables.push( chtObj );

    gda.log(4,"cT: # " + iTable + " cols " + JSON.stringify(columns));

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
            else if (isSLIDcES(d[name]))
                return createSLIDcESlink(d[name]);
            else
            return d[name];
        }]
        );
    });
    }
    else
	chtObj.colAccessor = columns;


    return iTable;

            //var dEla = gda.addElement(dStr,"a");
                //dEla.setAttribute("href","javascript:gda.tablesReset("+i+",gda.sChartGroups);");
function createSLIDcESlink(d) {
    var slink = d.substring(d.indexOf(":")+1);
    return '<a href=\"javascript:gda.slides.open(\'' + slink + '\');\" >' + d + "</a>";
}
function createLink(d) {
    return '<a href=\"' + d + '\" target=\"_blank\">' + d + "</a>";
}
function createPhoto(d) {
    return '<img src=\"' + d + '\" alt=\"[ 404 ]\">';
}
}

gda.new_crossfilter = function(dS) {
    gda.log(3,"new_crossfilter, " + dS + " ***************");

    // for now, a cf and a chartgroup will be the same name, but a cf/ds doesn't necessary need/instantiate a chartgroup

    if (!gda.utils.fieldExists(gda.cf[dS])) {
        gda.cf[dS] = crossfilter();
        gda.cf[dS].dS = dS;    // for charts/tables to reference
        //gda.cf[dS] = crossfilter();
    }
    return gda.cf[dS];
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
function isSLIDcES(d) {
    return (typeof(d)==="string" && (d.indexOf("SLIDcES:")===0));
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

function addDCdiv(dEl, chartType, chtObj, cname, sChtGroup) {
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
                                                                        //sChtGroup sChartGroup gda.charts[i]
        dEla.setAttribute("href","javascript:gda."+chartType+"Reset("+chtObj.i+");");//, gda.charts);");
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

gda.saveState = function (d,i) { // or ? https://code.google.com/p/google-gson/

        gda.log(4,"saveState: d,i " + d + "," + i);
        var slidesAsTxt = gda.slideRegistry.asText();
        var dataSourcesAsTxt = gda.dataSources.asText();
        var metaSourcesAsTxt = gda.metaSources.asText();
        //var win;
        //var doc;
        //win = window.open("", "WINDOWID");
        //doc = win.document;
        //doc.open("text/plain");
        //doc.write("{");
        //doc.write('"version": "' + gda.version + '",\n\n');
        //doc.write('"minor": "' + gda.minor + '",\n\n');
        //doc.write('"branch": "' + gda.branch + '",\n\n');
        //doc.write('"help": "Manually Save: Right-Click, View Source, File/SaveAs name.csv"\n');
        //if (dataSourcesAsTxt)
        //    doc.write(',\n"dataSources" : ' + dataSourcesAsTxt);
        //if (slidesAsTxt)
        //    doc.write(',\n"slides" : ' + slidesAsTxt + '\n');
        //if (!dataSourcesAsTxt && !slidesAsTxt)
        //    doc.write(',\n\n"Warning": "Nothing to Save"\n');
        //doc.write("}");
        //doc.close();

        var txt = "{";
        txt = txt + '"version": "' + gda.version + '",\n\n';
        txt = txt + '"minor": "' + gda.minor + '",\n\n';
        txt = txt + '"branch": "' + gda.branch + '",\n\n';
        txt = txt + '"help": "Manually Save: Right-Click, View Source, File/SaveAs name.csv"\n';
        if (dataSourcesAsTxt && dataSourcesAsTxt !== "{}")
            txt = txt + ',\n"dataSources" : ' + dataSourcesAsTxt;
        if (metaSourcesAsTxt && metaSourcesAsTxt !== "{}")
            txt = txt + ',\n"metaSources" : ' + metaSourcesAsTxt;
        if (slidesAsTxt      && slidesAsTxt      !== "[]")
            txt = txt + ',\n"slides" : ' + slidesAsTxt + '\n';
        txt = txt + "}";
        //window.open("data:text/html;base64,"+btoa(txt));
        var win;
        var doc;
        win = window.open("", "WINDOWID");
        doc = win.document;
        doc.open("text/plain");
        doc.write(txt);
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

gda.restoreStateDeferred = function(error, qR, oR, bDashOnly, nSlideRef) {
    gda.log(4,"restoreStateDeferred e(" +
           (error ?
                (error.message ? 
                    error.message
                    :error.statusText)
                :"no error")+")");
    if (error || !oR || oR === undefined)  {
        alert(error ? error.message ? error.message : error.statusText : "'No error' error");
    }
    else
    {
    gda.log(4,"rSD allDataLoaded in " + JSON.stringify(oR).substring(0,120)+"...");
    // this could use a JSON.parse to check validity. SplitTest isn't loading in a composite.
    gda.restoreStateFromObject(oR, qR, bDashOnly, nSlideRef);
    if (gda.deferredHash !== undefined && gda.deferredHash !== null) {
        // or perhaps in restoreStateFromObject?
        var lH = gda.deferredHash;
        gda.log(4,"deferred Hash " + lH);
        gda.log(4,"deferred Hash " + JSON.stringify(lH));
        gda.deferredHash = null;
        window.location.hash = lH;
    }
    }
};

// restoreState as a depth-first loader, using queue.
gda.restoreStateFromObject = function(o, qR, bDashOnly, nSlideRef) {
    gda.log(4,"rSFO: bDO " + bDashOnly);
// place one for each item. it will be executed in order.
    _.each(o, function(opt, key) {
        switch (key.toLowerCase()) {
        case "comment":
        case "help":
        case "branch":
        case "version":
        case "minor":
                gda.log(4,"key, opt = " + key + ", " + opt);
                break;
        case "slideRefs".toLowerCase():                             // immediately load all slides referenced

                    // bDashOnly (and bDashIncludes in the slides) is a test
                    // implementation to aggregate charts from multiple sources
                    // on a dashboard.
                    // Subsequently this could be updated to include the individual chart definitions

                    // bDashOnly controls the aggregation of multiple slideRefs and/or
                    // multiple slides. Basically all items are funneled into the root
                    // slide.

                gda.log(4,"key      = " + key + "("+_.size(opt)+")",JSON.stringify(opt).substring(0,120)+"..." );
                _.each(opt, function(aSlideRef) {
                    if (!bDashOnly || (gda.utils.fieldExists(aSlideRef.bDashInclude) && aSlideRef.bDashInclude)) {
                    var sRef = undefined;
                    if (aSlideRef.bDashInclude) {
                        gda.slideRefs.push(aSlideRef);
                        sRef = gda.slideRefs.length-1;
                    }
                    var filepath = aSlideRef.dataprovider;
                    // change the slide references to be a dataSource, so they can be served up any way possible (file, http).
                    if (!gda.utils.fieldExists(aSlideRef.bLocalFile)|| aSlideRef.bLocalFile)
                    {
                            filepath = filepath + aSlideRef.datafile;
                    }
                    //except it's not immediate right now, but deferred
                    gda.SFwait++
                    gda.slideFileLoad(filepath, function(e,o) {
                                        gda.restoreStateDeferred(e,qR,o, bDashOnly, sRef );
                                        gda.SFwait--;
                                    });
                    }
                });
                break;
        default:
                gda.restoreItemFromState(qR, key, opt, bDashOnly, nSlideRef);    // serialize 'operations' in queue 
                break;
        };
    });
};

gda.restoreItemFromState = function(qR, key, opt, bDashOnly, nSlideRef) {
    gda.log(4,"rIFS: ",key.toLowerCase());
    switch (key.toLowerCase()) {
        case "view":
                // defer
                gda.log(4,">>> defer    view action");
                qR.defer( function(callback) {
                    gda.log(4,">>> deferred view action");
                    gda.view.redraw();
                    callback(null, {});
                });
                break;
        case "comment":
        case "help":
        case "branch":
        case "version":
        case "minor":
                gda.log(4,"key, opt = " + key + ", " + opt);
                gda.log(4,"alert! should not happen");
                break;
        case "slideRefs".toLowerCase():
                gda.log(4,"key      = " + key + "("+_.size(opt)+")",JSON.stringify(opt).substring(0,120)+"..." );
                gda.log(4,"alert! should not happen");
                break;
        case "dataSources".toLowerCase():
                gda.log(4,"key      = " + key + "("+_.size(opt)+")",JSON.stringify(opt).substring(0,120)+"..." );
                // defer
                gda.log(4,">>  defer    dataSource action");
                qR.defer( function(callback) {
                    gda.log(4,">>  deferred dataSource action");
                    gda.dataSources.restore(opt);
                    _.each(gda.dataSources.map, function(ds) {
                        // workaround, some existing slides may have ds's bLoaded set
                        ds.bLoaded = false;
                    });
                    callback(null, {});
                });
                break;
        case "metaSources".toLowerCase():
                gda.log(4,"key      = " + key + "("+_.size(opt)+")",JSON.stringify(opt).substring(0,120)+"..." );
                // defer
                gda.log(4,">   defer    metaSource action");
                qR.defer( function(callback) {
                    gda.log(4,">   deferred metaSource action");
                    gda.metaSources.restore(opt);
                    callback(null, {});
                });
                break;
        case "slides":
                gda.log(4,"key      = " + key + "("+_.size(opt)+")",JSON.stringify(opt).substring(0,120)+"..." );
                // defer
                qR.defer( function(callback) {
                     gda.slidesSources.restore(opt, bDashOnly, nSlideRef);
                    callback(null, {});
                });
                break;
        default:
                gda.log(4,"default hit!");
                gda.log(4,"key, opt = " + key + ", " + opt,JSON.stringify(opt).substring(0,120)+"..." );
                break;
    };
};

gda.slidesSources = {};
gda.slidesSources.restore = function(opt, bDashOnly, nSlideRef) {
    _.each(opt, function(aSlide) {    // just (key) if parseRows is used.
        // update o.slide to have the slide state defaults, where not set.
        var restoredSlide = jQuery.extend(true, gda.newSlideState(), aSlide);   // add any missing fields.

        // temp workaround for conversion #1
        // upconvert to 0.99.72's cf = {}, dimensions = {}, dataSource
        var tempConversionDSname = null;
        if (gda.utils.fieldExists(restoredSlide.dataprovider)) {
            var dsNew = gda.newDataSourceState();
            gda.utils.moveField("dataprovider", restoredSlide,dsNew);
            gda.utils.moveField("datafile",     restoredSlide,dsNew);
            restoredSlide.bLoaded = false;  // workaround for old files
            gda.utils.moveField("bLoaded",      restoredSlide,dsNew);
            gda.utils.moveField("bListOfMany",  restoredSlide,dsNew);
            gda.utils.moveField("bLocalFile",   restoredSlide,dsNew);
            gda.utils.moveField("bAggregate",   restoredSlide,dsNew);
            gda.utils.moveField("bTimestamp",   restoredSlide,dsNew);
            gda.utils.moveField("_idCounter",   restoredSlide,dsNew);
            gda.utils.moveField("keymap",       restoredSlide,dsNew);
            gda.utils.moveField("columns",      restoredSlide,dsNew);

            var dS = "ds"+dc.utils.uniqueId();
            if (dsNew.datafile.length>0) {
                var i = dsNew.datafile.indexOf(".");
                if (i>0) dS = dsNew.datafile.substring(0,i);
                else    dS = dsNew.datafile;
            }
            //else blank.

            tempConversionDSname = gda.dataSources.restoreOne(dS, dsNew);
            //if (dsNameUnique)
                //restoredSlide.dataSource = dsNameUnique;

        }

        if (gda.utils.fieldExists(restoredSlide.dataSource)) {
            // workaround for a few slides/ets.
            gda.utils.moveField("columns",      restoredSlide, gda.dataSources.map[restoredSlide.dataSource] );

            gda.log(4,"fix: slide has dataSource " + restoredSlide.dataSource);
            tempConversionDSname = restoredSlide.dataSource;
            delete restoredSlide.dataSource;
        }
        if (tempConversionDSname && gda.utils.fieldExists(restoredSlide.myCols) && gda.utils.fieldExists(restoredSlide.myCols.csetupDimsCols)) {    // just old school < 0.99.8x or so
            // should be stored as 'ChartGroup', but for early slides we'll use the available dS
            restoredSlide.myCols[tempConversionDSname] = {};
            gda.utils.moveField("csetupDimsCols", restoredSlide.myCols, restoredSlide.myCols[tempConversionDSname] );
            gda.utils.moveField("csetupHiddenTableCols", restoredSlide.myCols, restoredSlide.myCols[tempConversionDSname] );
            gda.utils.moveField("csetupSortTableCols", restoredSlide.myCols, restoredSlide.myCols[tempConversionDSname] );
        }

        // temp workaround for conversion #2
        // upconvert to 0.99.78's charts sChartGroup is no longer a default of "one", but the dataSource
        // must be after the dsNaming.
        _.each(restoredSlide.charts, function(aChart) {
            if (aChart.sChartGroup === "one")
                aChart.sChartGroup = tempConversionDSname;// restoredSlide.dataSource;
        });
        if (gda.utils.fieldExists(restoredSlide.bUseTable) && tempConversionDSname !== null) {
            var tNew = gda.newTableState();
            gda.utils.moveField("bUseTable", restoredSlide, tNew);
            gda.utils.moveField("bShowTable", restoredSlide, tNew);
            gda.utils.moveField("bHideShowTable", restoredSlide, tNew);
            gda.utils.moveField("bShowLinksInTable", restoredSlide, tNew);
            gda.utils.moveField("bShowPicturesInTable", restoredSlide, tNew);
            gda.utils.moveField("bShowTableColumnSelectors", restoredSlide, tNew);
            gda.utils.moveField("csetupSortTableCols", restoredSlide.myCols[tempConversionDSname], tNew);
            gda.utils.moveField("csetupHiddenTableCols", restoredSlide.myCols[tempConversionDSname], tNew);
            tNew.dataSource = tempConversionDSname; // eliminate
            tNew.sChartGroup = tempConversionDSname;
            gda.sEdS = tNew.sChartGroup; // temp workaround
            gda.addChartGroup(tNew.sChartGroup);
            restoredSlide.tables.push(tNew);
        }


    // I think this should go in Finish

    // non-conversion work!

    // in DashOnly mode, keep only the slides that are referenced
    if (!bDashOnly ||
        (gda.utils.fieldExists(restoredSlide.bDashInclude) &&
             restoredSlide.bDashInclude)) {

        // however, in DashOnly, there is just one aggregated slide.
        if (!gda.bDashOnly || gda.slides.list().length === 0) {
        gda.slides.append(gda.slide(restoredSlide));  // decorate 
            if (gda.bDashOnly) {
                _.each(gda._slide().charts, function(aChart) {
                    if (aChart.bDashInclude)
                        aChart.overrides.slideRef = gda.slideRefs[nSlideRef];  // eff? gda.slideRefs[n]
                });
            }
        }
        else
        {
            var s = gda._slide();
            // not the first slide in Dash only mode, so merge content into existing slide
            _.each(restoredSlide.charts, function(_aChart) {
                if (_aChart.bDashInclude) {
                    var aChart = _.findWhere(s.charts, {Title: _aChart.Title, sChartGroup: _aChart.sChartGroup});
                    if (aChart) {
                        // skip, can't duplicate
                        gda.log(0,"bDashOnly, duplicated chart: ",_aChart.Title,_aChart.sChartGroup);
                    }
                    else
                    {
                        // piecemeal for now
                        var dS = _aChart.sChartGroup;
                        gda.addChartGroup(dS);
                        _aChart.overrides.slideRef = gda.slideRefs[nSlideRef];  // eff? gda.slideRefs[n]
                        s.charts.push(_aChart);
                    }
                }
            });
        }


        // the purpose of bAny is to begin drawing the first
        // available slide as soon as possible.
        if (!gda.bAny) {
            gda.bAny = true;
            gda.setupSlideContents(restoredSlide);
            // presently if there is a source in a 2nd+ slide not in slide 1, it
            // doesn't get loaded yet. Could fix that here, or could load on demand
            // later, if called upon.

            // now this should probably go in the Finish
//            if (gda.sChartGroups.length>0)
//                gda.fileLoadImmediate();    // drive load ostensible for first slide that will be viewed

//            if (gda.sChartGroups.length === 0)  // main slide happens to be empty of charts tables etc.
                gda.view.redraw();
            }
        }

    });

}

gda.addChartGroup = function(sChartGroup) {
    if (!_.contains(gda.sChartGroups,sChartGroup))
        gda.sChartGroups.push(sChartGroup);
}

gda.setupSlideContents = function(aSlide) {
    _.each(aSlide.charts, function(aChart) {
        var dS = aChart.sChartGroup;
        gda.addChartGroup(dS);
    });
    _.each(aSlide.myCols, function(dsO,dS) {
        if (gda.utils.fieldExists(dsO.csetupDimsCols) &&
            dsO.csetupDimsCols.length>0)
            gda.addChartGroup(dS);
    });
    _.each(aSlide.tables, function(aTable) {
        var dS = aTable.sChartGroup;//dataSource;
        if (dS)
            gda.addChartGroup(dS);
    });
}

gda.utils.moveField = function(field,recOld,dsNew) {
if (gda.utils.fieldExists(recOld[field])) {
        dsNew[field] = recOld[field];
        delete recOld[field];
    }
};

gda.restoreState = function(text) {
    gda.log(4,"rS:");
    if (text) {
        var o = tryParseJSON(text);
        if (o) {
    gda.clearAllSlides();  // but currently adds a new blank one, so
    gda.slideRegistry.clear();
    gda._currentSlide = 0;
    gda.bAny = false;

            var qR = queue(1);    // serial. parallel=2+, or no parameter for infinite.
            gda.restoreStateFromObject(o, qR, false);
            qR.awaitAll(function(error, results) {
                            gda.log(4,"restoreState e(" +
                                   (error ?
                                        (error.message ? 
                                            error.message
                                            :error.statusText)
                                        :"no error")+")");
                            if (error) {// (|| !results || results.length<1)
                                gda.log(4,"restoreState: error!");
                            }
                            else
                                gda.log(4,"restoreState: complete");
                                gda.log(4,"rS: ",JSON.stringify(results));
            });
        }
    else alert("Unable to parse file");
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
    catch (e) { gda.log(4,"tryParseJSON: not JSON (" + jsonString + ")"); }

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
    gda.log(4,"==================File Load=====================");
    gda.log(4,"methodFR file name " + file.name);
    gda.log(4,"methodFR file lmd  " + file.lastModifiedDate);
    var filetype = gda.isDataFileTypeSupported(file.name);
    gda.log(4,"filetype " + filetype);
    if (!filetype) {
        alert("File is not a supported Data file type (.csv, .xml). " + file.name);
        return false;
    }
    if (gda && gda._slide) {
        var dsNew = gda.newDataSourceState();
        dsNew.dataLastModifiedDate = file.lastModifiedDate;
        dsNew.datafile = file.name;
        dsNew.dataprovider = "/";
        //dsNew.bLocalFile = true;
        //dsNew.bLoaded = false;
        //dsNew.bListOfMany = false;
        //dsNew.bAggregate = false;
        //dsNew._idCounter = 0;
        //dsNew.keymap = {};

        var dS = "blank";
        if (dsNew.datafile.length>0) {
            var i = dsNew.datafile.indexOf(".");
            if (i>0) dS = dsNew.datafile.substring(0,i);
            else    dS = dsNew.datafile;    // punt
        }

        var dsNameUnique = gda.dataSources.restoreOne(dS, dsNew);   // cleanup
        if (dsNameUnique) {
            gda.sEdS = dsNameUnique; // was gda._slide().dataSource = 
            // perhaps not until file is read?
        }
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
    gda.log(4,"==================File Load=====================");
    gda.log(4,"methodFR file name " + file.name);
    gda.log(4,"methodFR file lmd  " + file.lastModifiedDate);
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
    gda.log(4,"dataReady data "+ data && data.length>0 ?data.substring(0,120):"<none?>");
    var dR = [];
    // special case for JSON 'set' as string, convert to array
    if (data[0] === "{") {
        gda.log(4,"dataReady JSON");
        var o = JSON.parse(data);
        if (o) {
        dR = _.values(o);
        gda.log(4,"new " + JSON.stringify(dR));
        }
    }
    else
        dR = d3.csv.parse(data);    // parseRows
    if (dR) {
        var dS = gda.activedataSource(); //gda._slide().dataSource;   // need to manage this selection elsewhere contextually
        dR = gda.dataNativeReady(dS,dR);
        if (dR)
            gda.dataToCrossfilter(dS,dR);
    }
}

gda.dataToCrossfilter = function(dS,dR) {
    gda.log(0,"dataToCrossfilter");
    var ds = gda.metaSources.map[dS];
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {

    if ((gda.bPollTimer || // && gda.bPollAggregate) ||
        ds.bAggregate === true) && gda.cf[dS]) {
        if (!gda.bPollAggregate)
            gda.cf[dS].remove();    // but to filters, so might need to
                                // copy filters, remove, restore
    }
    else
        gda.new_crossfilter(dS);

    // should this be moved to FilterInternal? if so user can't override unless
    // implemented in an accessible member.
    // Keymap addition should be done at design time, not runtime? current functionality allows new columns to creep in.
    // KeymapAdd also adds to crossfilter.
    gda.dataKeymapAdd(dS,dR); // expects array, use slice(1) if parseRows is used above.
    dR.clear();
    gda.dataComplete(dS);
    }
}

gda.dataNativeReady = function(dS,dR) {
    if (gda.bFirstRowsOnly && dR.length>gda.nFirstRows)
        dR = _.first(dR, gda.nFirstRows);
    gda.log(4,"dataNativeReady Lin ", dR.length);
    //gda.log(4,"dataNativeReady "+dR);
    //gda.log(4,"dataNativeReady "+JSON.stringify(dR));

    var ds = gda.metaSources.map[dS];
    if (!ds) ds = gda.dataSources.map[dS];

// xxx prop comes from the metaS for the cf
// actually, could use one for the cf, and one for 'column' aggregation
    if (ds.bAggregate) {
        gda.log(4,"bAggregate, retain columns ",ds.columns);
    }
    else {  // the columns and keymaps should only be adjusted during edit,
            // or upon load of data with newly (since last edit) added columns, some of which may need a keymap
            // it is possible some columns are deleted, or renamed. Not handled specifically yet
        if (gda.allowEdit())    // only when editing. This should be implemented as an attribute set by caller
            ds.columns = [];
        //gda._slide().columns = [];  // start fresh
        //gda._slide().keymap = {};   // start fresh. This may need more work after dataSource refactor
        //gda._slide().filters = {};
    }

    if (ds.bListOfMany) {
        dataArrayReady(dS, [dR]); // null,
        return null;    // dataArrayReady uses a queue and callbacks to load 1+ files from a list_file.
    }
    else {
        dR = gda.dataSourceInternal(ds, dR);
        dR = gda.dataFilter(dR);
        // just acts on first record, so no assignment needed
        gda.dataFilterKeymapTransform(dS, dR); // sets slide columns, unless Aggregate and data previously loaded

        return dR;
    }
}

// incomplete conversion to support meta
gda.dataFilterKeymapTransform = function(dS, dR) {
    if (dR && dR.length>0) {
        var ds = gda.metaSources.map[dS];
        if(!ds) ds = gda.dataSources.map[dS];
        if (ds) {
        var keymap = {};
        //var bUpdateKeymap = false;
        if (ds && gda.utils.fieldExists(ds.keymap) && _.size(ds.keymap)>0) {
        keymap = JSON.parse(JSON.stringify( ds.keymap ));    // duplicate
        //bUpdateKeymap = (_.size(keymap) === 0 || ds.bAggregate);
        }
        var columns = [];
        columns = _.union(columns, ds.columns);
        if (ds && ds.bSparseData) // need to check every row's keys
            _.each(dR, function(dRN) {
                _.each(dRN, function(value, key) {    // just (key) if parseRows is used.
                    var keyold = key;
                    key = trimColName(key);
                    if (keyold !== key)
                        keymap[keyold] = key;   // holds mapping for non-compliant keys
                    if (!_.contains(columns, key))
                        columns.push(key);
                });
            });
        else
            _.each(dR[0], function(value, key) {    // just (key) if parseRows is used.
                var keyold = key;
                key = trimColName(key);
                if (keyold !== key)
                    keymap[keyold] = key;   // holds mapping for non-compliant keys
                if (!_.contains(columns, key))
                    columns.push(key);
            });
        if (_.size(keymap)>0) {
            gda.log(4,"dFKmT: " + JSON.stringify(keymap));
            ds.keymap  = keymap;
        }
        ds.columns = columns;
        //gda.log(4,"dataFilterKeymapTranform columns " + gda._slide().columns);
        }
        else
            gda.log(4,"dFKmT: "+dS+" undefined ds");
    }
}

// one array of data
// filters to cleanup via keymap
// adds to crossfilter
gda.dataKeymapAdd = function(dS,dR) { //columns,dR {

    if (dR && dR.length>0) {
        gda.log(4,"dataKeymapAdd, "+dS);
        //gda.log(4,"dataKeymapAdd b4 " + dR);
        //gda.log(4,"dataKeymapAdd b4 " + JSON.stringify(dR));
        var ds = gda.metaSources.map[dS];
        if(!ds) ds = gda.dataSources.map[dS];
        if (ds && gda.utils.fieldExists(ds.keymap))
        dR = _.map(dR, function(value, key) {
            var b = {};
            _.map(value, function(v, k) {
                var k1 = ds.keymap[k] || k;
                b[k1] = v;
            });
            return b;
        });
        dataAdd(dS,dR);
    }
}

gda.slidesLoadImmediate = function(slidespath, bDashOnly) {
    gda.log(4,"sLI:");
    if (slidespath && slidespath.length>0) {
    gda._slidefile = slidespath;    // store path
    var qR = queue(1);  // qR for restored elements of slides  // serial. parallel=2+, or no parameter for infinite.
    gda.SFwait = 1; // also resets if something went wrong on an earlier load
    gda.slideFileLoad(slidespath, function(e,o) {
                        gda.restoreStateDeferred(e,qR,o, bDashOnly );
                        gda.SFwait--;
                    });
    setTimeout(function() {gda.slidesLoadFinish(qR)}, 250);  // 4 times per sec check if loading is finished
    }
};

gda.slidesLoadFinish = function(qR) {
    if(gda.SFwait>0) {
        setTimeout(function() {gda.slidesLoadFinish(qR)}, 250);  // 4 times per sec check if loading is finished
    }
    else
    qR.awaitAll(function(error, results) {  // then initiate the qR await
            gda.log(4,"sLI qR e(" +
                   (error ?
                        (error.message ? 
                            error.message
                            :error.statusText)
                        :"no error")+")");
            if (error) {// (|| !results || results.length<1)
                gda.log(4,"sLI: error!");
            }
            else
                gda.log(4,"sLI: complete");
                gda.log(4,"sLI: ",JSON.stringify(results));
    });
};

// need to refactor this to use the 'data file' framework, but with specialized callbacks
// for the data
gda.slideFileLoad = function (slidespath, callback) {
    gda.log(4,"sFL: " + slidespath);
    var _aData = {};
    _aData["Timestamp_get"] = new Date();
    if (slidespath && slidespath.length>0) {
            //var qF = queue(1);    // serial. parallel=2+, or no parameter for infinite.
            //qF.defer(d3.json,slidespath);                       // this should not be queued xxx
            //qF.awaitAll(callback); //gda.restoreStateDeferred;
            d3.json(slidespath, function(e,d) {
                _aData["Timestamp_complete"] = new Date();
                _aData["TimeMS"] = _aData["Timestamp_complete"] - _aData["Timestamp_get"];
                //ingestArray("slideRef",[[_aData]]);
                callback(e,d);
            });
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
        case /csv/.test(filetype):
        case /json/.test(filetype):
        case /xml/.test(filetype):
            break;  // continue
        case /http:/.test(filepath):
        case /https:/.test(filepath):
            return "unk";
        default:
            return false;
    }
    return filetype;
};

// modify fileLoadImmediate, manageInputSource to take a callback, so that
// it can be used for GeoJSON loading, too?
// Then dataSource or more likely Slide must specify the destination, too.

// xxx needs work

// returns true if it did a deferred load
// might be able to eliminate this and use the newer support
gda.fileLoadImmediate = function(bForce) {
    // presently this assumes all charts loaded with a slide are 'instantiated' and thus
    // available in gda.sChartGroups. Change this to iterate over all the consumers (charts, tables, etc)
    // and drive the loads from them.
    // To optimize this further it could begin loading the current dS/mS selection first, which would
    // only benefit the Editor, so no dice for now.
    //_.each(gda.charts, function(aChart) {
        //var dS = aChart.sChartGroup 
    _.each(gda.activeChartGroups(), function(dS) {
        var ds = gda.metaSources.map[dS];
        if (ds) {   // mS. no direct load, but as needed by operator (join ,etc).
        } else {
        ds = gda.dataSources.map[dS];
        if (ds && gda.utils.fieldExists(ds.dataprovider)) {
        var filepath = ds.dataprovider;
        if (!gda.utils.fieldExists(ds.bLocalFile) || ds.bLocalFile) filepath = filepath + ds.datafile;

        if (!gda.utils.fieldExists(ds.bLoaded) || !ds.bLoaded || bForce) {    // only if not already loaded.
            ds.bLoaded = false;
			if (filepath.trim().length>0) {
				var filetype = gda.isDataFileTypeSupported(filepath);
				if (!filetype) {
				alert("Unsupported file type: " + filepath);
				return false;
				}

                if (gda.mySpinner) gda.mySpinner.start();

				gda.log(2,"selFile " + filepath );
                if (!isHttp(filepath)) // originally used to override caching.
		//if (!ds.bLocalFile && gda.bPollTimer)	// might need 'overrideCache' attribute
				    filepath = filepath + "?q="+Math.random();	// override caching by randomly changing the request path
				gda.log(4,"selFile " + filepath + " type " + filetype);
                var qF = queue(1);    // serial. parallel=2+, or no parameter for infinite.
                // need to associate the dataSource with the timer... just the 'active' one for now
                //var dS = gda.sEdS; // gda._slide().dataSource;   // needs to be specified per dataSource
                //var ds = gda.dataSources.map[dS];  // needs to be specified per dataSource
                switch (filetype) {
                case "unk":
                case "json":
                        //qF.defer(d3.json,filepath);
                        var xhr = d3.json(filepath)
                                        .on("progress", function() {
                                            gda.log(1,"progress", d3.event.loaded, d3.event.total);
                                         }); // continue: http://bl.ocks.org/mbostock/3750941
                                        //.on("timeout", function(e){
                                        //    alert("timeout " + JSON.stringify(e));
                                        //});
                        ds.Timestamp_get = new Date();  // calling defer can start the operation
                        qF.defer(xhr.get);
                                    //.on("progress", function() {}) // continue: http://bl.ocks.org/mbostock/3750941
                                    //.get, "error");
                        qF.awaitAll( function(error, dataArray) {
                            ds.Timestamp_complete = new Date();
                            gda.log(0,"time(get,ms) = ",ds.Timestamp_complete - ds.Timestamp_get,filepath);
                            if (gda.utils.fieldExists(gda.dataSources.map[gda.sTimingDS])) {
                                var _aData = {};
                                
                                _aData["Timestamp_complete"] = ds.Timestamp_complete;
                                _aData["Timestamp_get"] = ds.Timestamp_get;
                                _aData["TimeMS"] = ds.Timestamp_complete - ds.Timestamp_get;
                                ingestArray(gda.sTimingDS,[[_aData]]);
                            }
                            if (ds.bListOfMany) {
                                if (errorCheck("dataArrayReady, json", error)) return;
                                dataArrayReady(dS, dataArray);
                            }
                            else {
                                if (errorCheck("allDataLoaded, json", error)) return;
                                allDataLoaded(dS, dataArray);
                            }
                        });
                        break;
                case "csv":
                        ds.Timestamp_get = new Date();  // calling defer can start the operation
                        qF.defer(d3.csv,filepath);
                        qF.awaitAll(function(error, dataArray) {
                            ds.Timestamp_complete = new Date();
                            gda.log(0,"time(get,ms) = ",ds.Timestamp_complete - ds.Timestamp_get,filepath);
                            if (gda.utils.fieldExists(gda.dataSources.map[gda.sTimingDS])) {
                                var _aData = {};
                                
                                _aData["Timestamp_complete"] = ds.Timestamp_complete;
                                _aData["Timestamp_get"] = ds.Timestamp_get;
                                _aData["TimeMS"] = ds.Timestamp_complete - ds.Timestamp_get;
                                ingestArray(gda.sTimingDS,[[_aData]]);
                            }
                            if (ds.bListOfMany) {
                                if (errorCheck("dataArrayReady, csv", error)) return;
                                dataArrayReady(dS, dataArray);
                            }
                            else {
                                if (errorCheck("allDataLoaded, csv", error)) return;
                                allDataLoaded(dS, dataArray);
                            }
                        });
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
        }
    });
    return false;
};

// how to use other handlers with json.
//var xhr = d3.json(url)
//    .on("progress", function() { gda.log(4,"progress", d3.event.loaded); })
//    .on("load", function(json) { gda.log(4,"success!", json); })
//    .on("error", function(error) { gda.log(4,"failure!", error); })
//    .get();
// For using with queueo
//queue().defer(d3.json("file1.json")
//                 .on("progress", function({gda.log(d3.event.loaded);})                                               
//                 .get, /*First argument*/ "error")
//       .await(function (error, file1_data) {gda.log(file1_data);});


var tfiletype = null;   // working values, refactor into mIS
var tfilepath = null;
gda.manageInputSource  = function() {
    gda.log(4,"gda.manageInputSource: created ===========================1");
    return {
        clear: function() {
            gda.log(1,"mIS clear:   =======================    ");
        },
        pollTimerStart: function() {
            if (!gda.bPollTimerRunning) {
                var iMS = gda.nPollTimerMS;
                gda.log(1,"mIS pollTS: " + iMS + " ====================    ");
                gda.bPollTimerRunning = true;
                // d3.timer may have advantages for not running when not displayed
                // and easier? to gang up several different file polls?
                // But SetInterval will keep running while not displayed, that would
                // be beneficial since no backing server is tracking state during that time.
                d3.timer(gda.manageInputSource.pollTimerTick, 0);// 0, so it's called immediately, +iMS);
                //gda.manageInputSource.poll(); // and don't need this. allows _elapsed to be synced
            }
            else gda.log(1,"mIS pollTS: already running");
        },
        pollTimerTick: function (msElapsed) {
            if (msElapsed>=gda.nPollTimerExpires) {
            gda.log(1,"mIS tick:   ======================== ",msElapsed,gda.nPollTimerExpires);
            if (gda.bPollTimer) {
                //now called from the slide display part
                //gda.manageInputSource.pollTimerStart(); // reschedule
                gda.nPollTimerExpires = +gda.nPollTimerExpires + +gda.nPollTimerMS;
                gda.manageInputSource.poll();
            }
            }
            return gda.bPollTimer===false; //workaround bug?
        },// only read/cf()(/refresh?) is needed, assuming new values won't show over time.
        // that could be an option for when adding sensors.
        // two types of polled sources
        // - current state, keep repolling to see latest
        // - growing stream, either replace all contents, or track new/diff only
        source: function(filetype, filepath) {
            gda.log(1,"mIS source: ========================    ");
            tfiletype = filetype;
            tfilepath = filepath;
            if (gda.bPollTimer)
                gda.manageInputSource.pollTimerStart();
            //gda.manageInputSource.poll();   //once, unless bPollTimer
        },
        poll: function() {
            gda.log(1,"mIS poll:   ========================    ");
            gda.fileLoadImmediate(true);
        }
    };
    gda.manageInputSource.clear(); // initialize upon first use
    gda.log(4,"gda.manageInputSource: ready =============================2");
}();

function xmlDataLoaded(error, xml) {
    gda.log(4,"xml " + xml);
    gda.log(4,"xml " + JSON.stringify(xml));
};

function errorCheck(sName, error) {
    gda.log(sName + " e(" +
           (error ?
                (error.message ? 
                    error.message
                    :error.statusText)
                :"no error")+")");
    return error;
};

function dataArrayReady(dS, dataArray) {    // error   [ [{},{}] , ... ]
    var ds = gda.metaSources.map[dS];
    if(!ds) ds = gda.dataSources.map[dS];
    if (ds) {
    gda.log(4,"bListOfMany " + ds.bListOfMany);
    if (!error && dataArray && dataArray.length>0)  {
        gda.log(4,"dataArrayReady e(" + error+") Lin ", dataArray.length);
        gda.log(4,"dataArrayReady "+JSON.stringify(dataArray) );

        // load each deferred via queue
        var qA = queue(1);    // serial. parallel=2+, or no parameter for infinite.
        gda.log(4,"dataArrayReady len " + dataArray.length);

        gda.cf[sFileChartGroup].remove();    // but to filters, so might need to
        var cf2 = gda.new_crossfilter(sFileChartGroup);

        gda.log(4,"dAR: File Table dimension ***=-=-=-=-=-=-=-=-=-=-=-=***");
        var dateDimension2 = cf2.dimension(function (d) { return d.dd; });
        var iTable2 = gda.createTable(cf2, dateDimension2, ["Tests"], sFileChartGroup);// needs it's own group
        var s9 = document.getElementById('FileTable');
        gda.newTableDisplay(s9,iTable2);//, ".dc-list-table", ".dc-list-count");
        gda.addChartGroup(sFileChartGroup);
        gda.log(4,"renderALL dataArrayReady ");
        dc.renderAll(sFileChartGroup);
        for (var iDA=0;iDA<dataArray.length;iDA++){
            // add dataArray[iDA] to a dataTable with group sChartGroupList

            // add file list to a 2nd cross filter and display in a table
            cf2.add(dataArray[iDA]);

            _.each(dataArray[iDA], function(dAvalue, iInDA) {
                var dA = dAvalue;//dataArray[iDA];
            _.each(dA, function(value, key) {    // just (key) if parseRows is used.
                gda.log(4," defer key " + key + " v " + JSON.stringify(value));
                var p = value;    // eliminate?
                if (p) {        // eliminate?
                    var p1 = p.replace(/\\/g,"/");
                    gda.log(4," p " + p + " becomes " + p1);
                    p = p1;
                    qA.defer(d3.csv, p );   // could specify the DCcsvFilter by row here, as third param
                }
            });
            });
        }
        qA.awaitAll(//allDataLoaded  // read them all, then continue
                    function(error, dataArray) {
                        if (errorCheck("allDataLoaded", error)) return;
                        allDataLoaded(sFileChartGroup, dataArray);
                    });
    }
    }

    return null;
}

function allDataLoaded(dS, testArray) {
    if (testArray && testArray.length>0) {
        ingestArray(dS, testArray);
    }
};

function ingestArray(dS, testArray) {
    gda.log(0,"ingestArray");
    var ds = gda.metaSources.map[dS];
    if (!ds) ds = gda.dataSources.map[dS];
    if (ds) {
    gda.log(2,"ingestArray in, " + dS + ", size= " + testArray.length + " <==========");
    
    // workaround, current implementation causes multiple loads of same file to be triggered.
    // so if already loaded, skip.
    if (ds.bLoaded && !gda.bPollTimer) {
        gda.log(2,"ingestArray, skipping " + dS + ", already loaded. Requires design improvement");
        if (gda.mySpinner) gda.mySpinner.stop();
    }
    else
    {

    // special case for JSON 'set' as string, convert to array
    if (testArray.length === 1 &&
        gda.utils.fieldExists(testArray[0]["1"]) &&
        gda.utils.fieldExists(testArray[0]["1"].DeviceID)) {
        gda.log(4,"ingestArray JSON");  // special case for now, Almond+
        var o = testArray[0];
        if (o) {
        testArray = [_.values(o)];
        gda.log(4,"new " + JSON.stringify(o));
        }
        else
            testArray = []; // not valid
        
    }
    if (testArray.length>0)
        gda.log(4,"ingestArray in " + JSON.stringify(testArray[0]).substring(0,120) + "... <==========");
    if (testArray && testArray.length>0) {// && testArray[0] // relaxed 10/4/2014 && testArray[0].length>0

        // don't do most/all of this on a joined dataSource. already performed on the pieces.
        // unless there is some benefit to have another user filter on the result...

        for (var i=0;i<testArray.length && (i<gda.nFirstRows || !gda.bFirstRowsOnly) ;i++){   // 1+. 0 is column headings
            gda.log(4,"ingestArray: filtering " + (i+1) + " of " + testArray.length);
            dR = testArray[i];
            if (gda.bFirstRowsOnly && dR.length>gda.nFirstRows)
                dR = _.first(dR, gda.nFirstRows);
            dR = gda.dataSourceInternal(ds, dR);
            dR = gda.dataFilter(dR);    // operates on one set

            // just acts on first record, so no assignment needed
            // however, this sets the available columns
            if (!gda.bPollTimer)// || !gda.bPollAggregate
                gda.dataFilterKeymapTransform(dS, dR);

            testArray[i] = dR;
        }

        gda.log(4,"ingestArray Lin " + testArray.length );

        if ((gda.bPollTimer || // && gda.bPollAggregate ||
             ds.bAggregate === true) && gda.cf[dS]) {   // was dS
                if (!gda.bPollAggregate)
                    gda.cf[dS].remove();    // was dS // but to filters, so might need to...
        }
        else {
            if (!ds.bAggregate && gda.utils.fieldExists(gda.cf[dS]))
                gda.cf[dS].remove();    // was dS // but to filters, so might need to...
            gda.new_crossfilter(dS);
        }

        for (var i=0;i<testArray.length && (i<gda.nFirstRows || !gda.bFirstRowsOnly) ;i++){   // 1+. 0 is column headings
            gda.log(4,"ingestArray dataKeymapAdd ");
            var dR = testArray[i];
            if (dR instanceof Array) {
            gda.dataKeymapAdd(dS,dR);
            dR.clear();
            //testArray[i] = dR;
        }
        }
        testArray.clear();
    }

    gda.log(2,"ingestArray done  <==========");

    if (dS != gda.sTimingDS) {
        gda.dataComplete(dS);
    }
    else {
        _.each(gda.charts, function(chtObj) {
            if (chtObj.sChartGroup === dS &&
                chtObj.chartType === "Scatter") {
                gda.scatterDomains(chtObj,false); // update
                //chtObj.chart.render();
            }
            else if (chtObj.sChartGroup === dS &&
                chtObj.chartType === "Line") {
                gda.lineDomains(chtObj,false);  // update
            }
        });
        dc.redrawAll(dS); //some charts are not updating (Line), but if a refresh is hit it does.
    }
    }
    }
    else
        gda.log(4,"ingestArray: dS " + dS + " undefined");
}

function dataAdd(dS, data) {
    gda.log(4,"dataAdd, " + dS + ", data " + JSON.stringify(data).substring(0,120) + "...");
    gda.cf[dS].add(data);
    //gda.log(4,"dataAdd data " + JSON.stringify(data));
    gda.log(4,"dataAdd cf("+dS+") now at "+ gda.cf[dS].size());
}

// placeholder for user override
gda.dataFilter = function(data) {
    gda.log(4,"gda.dataFilter");
    return data;
}

function trimColName(cname) {
    var cnameOrig = cname;
    if (cname.trim().length===0) cname = "blank"+(++iUid);
    else {
        cname = cname.replace(/\?/g,"_");    // replace QuestionMark
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
    if (cnameOrig !== cname)
        gda.log(4,"Cleaned Column Name: from '" + cnameOrig + "' to " + cname );
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
        var dElt = gda.addElement(dElHost,"label");    // dElb
            dElt.setAttribute("class","label");
    var checkb = document.createElement("input");
    checkb.type = "checkbox";
    checkb.class = className;
    checkb.id = "c"+dElHost.id+"c"+theValue;
    checkb.name = "c"+dElHost.id;
    checkb.value = theValue;
    checkb.checked = defV;
    dElt.appendChild(checkb);    // dElHost
    d3.selectAll("input[id="+checkb.id+"]")
        .on("change", function() {
            changedCallback(this);
        });
    //var Luse = document.createElement("label");
    //Luse.htmlFor = checkb;
    //Luse.appendChild(document.createTextNode(sLabel));
    //dElt.appendChild(Luse);     // dElHost
    dElt.appendChild(document.createTextNode(sLabel));
    return gda;
    // http://getbootstrap.com/css/, mods to work with bootstrap
    // not ideal. perhaps a different flavor.
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

gda.addTextEntry = function(dElHost, fieldname, sText, defV, callback) {
    var inputT = document.createElement("input");
    inputT.type = "text";
    inputT.id = "C"+fieldname.replace(/ /g,"_").replace(/:/g,"_");	
    inputT.name = fieldname;//.replace(/ /g,"_").replace(/:/g,""); 08/16/2014 unneeded?	// was ,"_", causes fieldname to not match list
    inputT.value = defV;
    var Luse = document.createElement("label");
    Luse.htmlFor = inputT;
    Luse.appendChild(document.createTextNode(sText+':'));
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
