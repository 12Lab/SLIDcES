
siteSpecific = {};

siteSpecific.selectAndFilter = function(data) {
    if (data && data.length>0) {
        if (data[0].DeviceValues)
            data = siteSpecific.almondPlus(data);
        else if (data[0].Head_Inches) {
            var notenthFormat = d3.format(".0f");
            _.each(data, function(d) {
                if (d.Watts)
                    d.Efficiency = notenthFormat(d.GPH / d.Watts);
                if (d.Price)
                    d.Price = d.Price.substring(1);
            });
        }
        else if (data[0]["N-Cream"]) {
            _.each(data, function(d) {
                d["N-Cream"] = +d["N-Cream"]
                d["M-Cream"] = +d["M-Cream"]
                d["Panellist"] = +d["Panellist"]
                d["Product number"] = +d["Product number"]
            });
        }
        else if (gda.utils.fieldExists(data[0]["Sub-issue"])) {
            var format = d3.time.format("%m/%d/%Y");
            _.each(data, function(d) {
                d.Received = format.parse(d["Date received"]);
                gda.utils.addDateOption(d,"Received","Month");
                gda.utils.addDateOption(d,"Received","Months");
                gda.utils.addDateOption(d,"Received","Year");
                d.Sent = format.parse(d["Date sent to company"]);
                gda.utils.addDateOption(d,"Sent","Month");
            });
        }
        else if (gda.utils.fieldExists(data[0]["Issue"])) {
            var format = d3.time.format("%m/%d/%Y");
            _.each(data, function(d) {
                d.End = format.parse(d["End_Date"]);
                gda.utils.addDateOption(d,"End","Quarter");
                d.Start = format.parse(d["Start_Date"]);
                gda.utils.addDateOption(d,"Start","Quarter");
            });
        }
        else if (gda.utils.fieldExists(data[0]["sensor_location_name"])) {
            var format = d3.time.format("%Y-%d-%mT%H:%M:%S");
            var Now = new Date();
            var NextYear = new Date(Now.getFullYear()+1,0,1);
            var daysFormat = d3.format(".0f");
            console.log("BH dataFilter");
            var bDT = gda.utils.fieldExists(data[0]["datetime"]);
            _.each(data, function(d) {
                d.dd = format.parse(d["datetime"]);
                gda.utils.addDateOptions(d,d.dd);    // add Year,Quarter,Month,Week,Day
            });
	    }
        // for 'cars' example
        else if (gda.utils.fieldExists(data[0].cylinders)) {
            var format = d3.time.format("%Y");
            _.each(data, function(d) {
                d.dd = format.parse(d.year);
                gda.utils.addDateOptions(d,d.dd);
            });
        }
        else if (gda.utils.fieldExists(data[0].year)) {
            var format = d3.time.format("%Y");
            _.each(data, function(d) {
                d.dd = format.parse(d.year);
                gda.utils.addDateOptions(d,d.dd);
            });
        }
        else if (gda.utils.fieldExists(data[0]["Date"])) {
            var format = d3.time.format("%Y-%m-%d");
            _.each(data, function(d) {
                d.dd = format.parse(d.Date);
            });
        }

        TcumFileUnits = 1;
        _.each(data, function(d) {
            d.cumFileUnits = TcumFileUnits; 
            TcumFileUnits++;
        })
    }
    return data;
}

siteSpecific.almondPlus = function(data) {
    var newData = [];
    _.each(data, function(d) {
        if (d.DeviceValues) {
            var devValues = _.values(_.pick(d, "DeviceValues"));
            if (devValues) {
                devValues = _.map(devValues[0], function(v,k) {
                    return _.omit(v,"index");
                });
                if (gda.utils.fieldExists(d.Timestamp))
                    gda.utils.addDateOptions(d,d.Timestamp);
                d =  _.omit(d, "DeviceValues");
                var newEntries = {};
                _.each(devValues, function(v1,k1) {
                    newEntries[v1.name] = v1.value;
                });
                newEntries["asVal"] = 0;
                switch(d.DeviceType) {
                    case "19":
                        newEntries["ARMMODE"] = newEntries["ARMMODE"]==="0"? "Off" : "On";
                        break;
                    case "12":
                        newEntries["asVal"] = +newEntries["asVal"] + (newEntries["STATE"]==="false"? 0.1 : 1);
                        newEntries["STATE"] = newEntries["STATE"]==="false"? "Closed" : "Open";
                        newEntries["LOW BATTERY"] = newEntries["LOW BATTERY"]==="false"? "Good" : "LOW";
                        newEntries["asVal"] = +newEntries["asVal"] + (newEntries["TAMPER"]==="false"? 0.1 : 0.5);
                        newEntries["TAMPER"] = newEntries["TAMPER"]==="false"? "Okay" : "TAMPERED";
                        break;
                    case "4":
                        var finalEntries = {};
                        finalEntries["Lamp State"] = newEntries["SWITCH BINARY"]==="false"? "Off" : "On";
                        finalEntries["Lamp Level"] = (100* +newEntries["SWITCH MULTILEVEL"])/255;
                        finalEntries["asVal"] = finalEntries["Lamp Level"];
                        newEntries = finalEntries;
                        break;
                    case "22":
                        var finalEntries = {};
                        finalEntries["asVal"] = newEntries["asVal"];
                        finalEntries["SWITCH BINARY"] = newEntries["SWITCH BINARY"]==="false"? "Off" : "On";
                        var acPm = parseInt(newEntries["AC_POWERMULTIPLIER"],16);
                        var acPd = parseInt(newEntries["AC_POWERDIVISOR"],16);
                        var acVm = parseInt(newEntries["AC_VOLTAGEMULTIPLIER"],16);
                        var acVd = parseInt(newEntries["AC_VOLTAGEDIVISOR"],16);
                        var acCm = parseInt(newEntries["AC_CURRENTMULTIPLIER"],16);
                        var acCd = parseInt(newEntries["AC_CURRENTDIVISOR"],16);
                        var acF = parseInt(newEntries["AC_FREQUENCY"],16);
                        var acP = parseInt(newEntries["ACTIVE_POWER"],16);
                        acP = acP*acPm/acPd;
                        var acVrms = parseInt(newEntries["RMS_VOLTAGE"],16);
                        acVrms = acVrms*acVm/acVd;
                        var acCrms = parseInt(newEntries["RMS_CURRENT"],16);
                        acCrms = acCrms*acCm/acCd;
                        finalEntries["AC_Frequency"] = acF;
                        finalEntries["AC_Power"] = acP;
                        finalEntries["AC_VoltageRMS"] = acVrms;
                        finalEntries["AC_CurrentRMS"] = acCrms;
                        newEntries = finalEntries;
                        break;
                }
                _.extend(d, newEntries);
            }
            newData.push(d);
        }
    });
    return newData;
}
