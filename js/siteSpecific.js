
siteSpecific = {};

siteSpecific.selectAndFilter = function(data) {
    if (data && data.length>0) {
        if (data[0].DeviceValues)
            data = siteSpecific.almondPlus(data);
        else if (data[0]["N-Cream"]) {
            _.each(data, function(d) {
                d["N-Cream"] = +d["N-Cream"]
                d["M-Cream"] = +d["M-Cream"]
                d["Panellist"] = +d["Panellist"]
                d["Product number"] = +d["Product number"]
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
                switch(d.DeviceType) {
                    case "19":
                        newEntries["ARMMODE"] = newEntries["ARMMODE"]==="0"? "Off" : "On";
                        break;
                    case "12":
                        newEntries["STATE"] = newEntries["STATE"]==="false"? "Closed" : "Open";
                        newEntries["LOW BATTERY"] = newEntries["LOW BATTERY"]==="false"? "Good" : "LOW";
                        newEntries["TAMPER"] = newEntries["TAMPER"]==="false"? "Okay" : "TAMPERED";
                        break;
                    case "22":
                        var finalEntries = {};
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
