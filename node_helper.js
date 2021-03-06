"use strict";
const NodeHelper = require("node_helper");
const VbbFetcher = require("./VbbFetcher");
const lineColors = require("vbb-line-colors");

module.exports = NodeHelper.create({

    start: function () {
        this.departuresFetchers = []
    },

    createFetcher: function (config) {
        let fetcher;

        if (typeof this.departuresFetchers[config.stationId] === "undefined") {

            fetcher = new VbbFetcher(config);
            this.departuresFetchers[config.stationId] = fetcher;
            this.sendInit(fetcher);

            fetcher.getStationName().then((res) => {
                console.log("Transportation fetcher for station " + res + " created. (Station ID: " + fetcher.getStationId() + ")");
            })
        } else {
            fetcher = this.departuresFetchers[config.stationId];
            this.sendInit(fetcher);

            fetcher.getStationName().then((res) => {
                console.log("Using existing transportation fetcher for station " + res + " (Station ID: " + fetcher.getStationId() + ")");
            });
        }
        this.getDepartures(fetcher.getStationId());
    },

    sendInit: function (fetcher) {
        fetcher.getStationName().then((name) => {
            this.sendSocketNotification("FETCHER_INIT", {
                stationId: fetcher.getStationId(),
                stationName: name
            });
        });
    },

    getDepartures: function (stationId) {
        this.departuresFetchers[stationId].fetchDepartures().then((departuresData) => {
            this.pimpDeparturesArray(departuresData.departuresArray);
            this.sendSocketNotification("DEPARTURES", departuresData);
        }).catch((e) => {
            let error = {};
            console.log("Error while fetching departures (for Station ID " + stationId + "): " + e);
            // Add stationId to error for identification in the main instance
            error.stationId = stationId;
            error.message = e;
            this.sendSocketNotification("FETCH_ERROR", error);
        });
    },

    pimpDeparturesArray: function (departuresArray) {
        let currentProperties = {};

        departuresArray.forEach((current) => {
            currentProperties = this.getLineProperties(current);

            //if (!this.config.marqueeLongDirections) {
            //    current.direction = this.trimDirectionString(current.direction);
            //}
            current.bgColor = currentProperties.bgColor;
            current.fgColor = currentProperties.fgColor;
            current.cssClass = currentProperties.cssClass;
        });

        return departuresArray;
    },

    getLineProperties: function (product) {
        let properties = {
            bgColor: "#333",
            fgColor: "#FFF",
            cssClass: ""
        };

        let type = product.type;
        let lineType = product.line;
        let name = product.name;
        let colors = {};

        switch (type) {
            case "suburban":
                colors = lineColors.suburban[name];
                properties.cssClass = "sbahnsign";
                break;
            case "subway":
                colors = lineColors.subway[name];
                properties.cssClass = "ubahnsign";
                break;
            case "bus":
                colors.bg = "#B60079";
                colors.fg = "#FFF";
                properties.cssClass = "bussign";
                break;
            case "tram":
                colors = lineColors.tram[name];
                properties.cssClass = "tramsign";
                break;
            case "regional":
                colors = lineColors.regional[name];
                properties.cssClass = "dbsign";
                break;
            case "express":
                if (lineType === "LOCOMORE") {
                    colors.bg = "#E5690B";
                    colors.fg = "#3E1717";
                    properties.cssClass = "locsign";
                } else {
                    properties.cssClass = "expresssign";
                }
                break;
        }

        // Change default values if we changed them
        if ("bg" in colors) {
          properties.bgColor = colors.bg;
        }

        if ("fg" in colors) {
          properties.fgColor = colors.fg;
        }

        return properties;
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_DEPARTURES") {
            this.getDepartures(payload);
        }

        if (notification === "CREATE_FETCHER") {
            this.createFetcher(payload);
        }

        if (notification === "STATION_NAME_MISSING_AFTER_INIT") {
            this.sendInit(this.departuresFetchers[payload]);
        }
    }
});
