// npm install puppeteer
// npm i -S image-hash
// npm install node-salesforce
const request = require("request");
var pHash = require("image-hash");
const qs = require("querystring");
const fs = require("fs");
var sf = require("node-salesforce");
const nrofdaysAnalytics = 14;
const debug = false;
const addGoogleSheet = false;
const puppeteer = require("puppeteer");
let browser; //= await puppeteer.launch();
const s3Loc = "https://s3.amazonaws.com/NOTYET/";
var SFDCConnection;

class InspectAllOrganizations {
  constructor() {
    let settings = require("../secrets/settings.json");
    this.apiKey = settings.apiKey;
    this.baseUrl = settings.baseUrl;
    this.baseUrlAnalytics = settings.baseUrlAnalytics;
    this.settings = settings;
  }

  async initPuppet() {
    browser = await puppeteer.launch();
  }

  getOptions() {
    return {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": 'application/json; charset="UTF-8"'
      }
    };
  }
  

  // function to encode file data to base64 encoded string
  getImage64(file) {
    try {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString("base64");
    }
    catch(e){
      return "";
    }
  }

  hammingDistance(str1, str2) {
    /* If the strings are equal, bail */
    if (str1 === str2) {
      return 0;
    }

    /*If the lengths are not equal, there is no point comparing each character.*/
    if (str1.length != str2.length) {
      return false;
    }

    /*loop here to go through each position and check if both strings are equal.*/
    var numDiffChar = 0;
    var index = 0;
    while (index < str1.length) {
      if (str1.charAt(index) !== str2.charAt(index)) {
        numDiffChar++;
      }
      index++;
    }
    return numDiffChar;
  }

  myimageHash(file) {
    let mydata = 0;
    let promise = new Promise(resolve => {
      let mydata2 = pHash.imageHash(file, 32, true, (error, data) => {
        mydata = data;
        resolve(mydata);
      });
    });
    return promise;
  }

  createWheel(data) {
    let r = 45,
      C = 2 * Math.PI * r;
    let v = data.value / (data.max || 100);
    let perc = Math.round(v * 100);
    let cssClass = "bad";
    if (data.smallerIsBetter) {
      cssClass = "good";
      if (v >= 0.75) {
        cssClass = "bad";
      } else if (v >= 0.5) {
        cssClass = "warn";
      }
      if (data.value >= 1) {
        cssClass = "bad";
      }
    } else {
      cssClass = "bad";
      if (v >= 0.75) {
        cssClass = "good";
      } else if (v >= 0.5) {
        cssClass = "warn";
      }
    }
    v = C * v;

    return `<div class="wheel ${cssClass}"><a href="#${
      data.title
    }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle class="back-ring" cx="50" cy="50" r="${r}" stroke-width="8"></circle>
        <circle class="value" fill="none" cx="50" cy="50" r="${r}" stroke-width="8" stroke-dasharray="${v} ${C}" ></circle>
        <text
          text-anchor="middle"
          font-size="30" font-family="Lato"
          transform="rotate(90 50,50)"
          lengthAdjust="spacingAndGlyphs" x="50" y="62">${perc}%</text>
      </svg>
      <div class="wheel-title"><span class="wheel-main">${data.title ||
        ""}</span><br>${data.value}/${data.max}<span class="wheel-sub">${
      data.subtitle
    }</span></div></a>
      </div>`;
  }

  getHTML(title, scores, details, images) {
    let html = `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato">
  <link rel="stylesheet" href="http://coveo.github.io/vapor/dist/css/CoveoStyleGuide.css">
  <link rel="stylesheet" href="https://static.cloud.coveo.com/styleguide/v2.10.0/css/CoveoStyleGuide.css">
  <meta http-equiv="Content-Security-Policy" content="script-src-elem 'none'; script-src 'none'">
  <style type="text/css">
  body.coveo-styleguide {display:block; padding: 0 30px 30px;}
  div.wheel {display: inline-block; text-align: center; margin: 5px 10px; cursor: default; width: 130px;}
  div.wheel svg {cursor: default; width: 80px; height: 80px; transform: rotate(-90deg);}
  div.wheel .wheel-title {margin-top: 5px; font-size: 1.4em;}
  div.wheel svg .back-ring {stroke: #E4EAED; fill: none;}
  div.wheel svg text {font-weight: bold;}
  div.wheel.good svg text {fill: #00983;}
  div.wheel.warn svg text {fill: #ecad00;}
  div.wheel.bad svg text {fill: #ce3f00;}
  div.wheel.good svg circle.value {stroke: #009830;}
  div.wheel.warn svg circle.value {stroke: #ecad00;}
  div.wheel.bad svg circle.value {stroke: #ce3f00;}
  header.header {min-height: 48px;}
  .header-section {font-size: 1.2em; font-weight: bold;}
  a {outline: none;}
  a img {outline: none;}
  img {border: 0;}
  a:focus {outline: none;}

h4 {
  font-size: 17px;
  background-color: lightyellow;
  font-weight: bold;
}

.mytable {
  border: none;
  padding: 5px;
}

.myexpr {
  width: 200px;
}

.myexprval{
  width: 500px;
  font-weight: bold;
  font-size: 0.9em;
}

.myexprcomm{
  font-style: italic;
  padding-left: 15px !important;
}
  h3 {margin: 10px;}
  h3 i {font-style: italic;}
  .popup-content {padding-left: 8px; padding-right: 8px; padding-top: 0px; overflow: auto;}
  #myscreenimage {height: 200px; background-size: contain; background-repeat: no-repeat; background-position: top center; margin: 10px 20px; /*border: 1px solid silver;*/}
  #scores {text-align: center;}
  #scores div.wheel a svg {cursor: pointer;}

  .coveo-styleguide .collapsible .collapsible-header {background-position: left 20px center; display: flex; line-height: 50px;}
  .coveo-styleguide .collapsible .collapsible-header .msg {flex: 1;}
  .coveo-styleguide table:not(.datepicker-table) tr:hover td {background-color: transparent;}

  #details b {font-weight: bold;}
  #details i {font-style: italic;}
  .mycode {font-family: courier; font-variant: normal !important; font-weight: normal !important; word-wrap: break-word; white-space: pre-wrap; word-break: break-all;}
  .coveo-styleguide .collapsible .collapsible-header .details {color: #ce3f00; font-size: 8px;}
  .coveo-styleguide .collapsible .collapsible-header .result {color: #ce3f00; margin: auto;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel {position: relative; width: auto;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel svg {width: 40px; position: absolute; margin-top: -40px; margin-left: -10px;}
  .coveo-styleguide .collapsible .collapsible-header .result div.wheel svg .back-ring {stroke: #fff; fill: none;}
  .coveo-styleguide .collapsible .collapsible-header .result .wheel-title {display: none;}
  .coveo-styleguide .collapsible .collapsible-header.active {background-image: none;}
  .coveo-styleguide .collapsible .collapsible-body {display: block;padding: 0;}
  .coveo-styleguide table:not(.datepicker-table) td.line-result { text-align: left; font-weight: bold; vertical-align: top;}
  .coveo-styleguide table:not(.datepicker-table) th:last-child, .coveo-styleguide table:not(.datepicker-table) td:last-child {padding-left: 25px;}
  tr td.line-message small {vertical-align: top !important;font-size: small; color: #1d4f76; display: block; /*padding-left:25px;*/}
  tr td.line-mandatory {vertical-align: top !important; text-align: right; width: 48px !important;padding-right: 1px !important;padding-left: 1px !important;}
  tr td.line-indicator {  border-right: none;  vertical-align: top !important;  padding-right: 1px !important;padding-left: 1px !important;}
  tr td.line-message {vertical-align: top !important; text-align: right; width: 350px; padding-left: 1px !important;vertical-align: top !important;}
  tr td.line-result {background-position: left 5px top 12px; background-repeat: no-repeat; background-size: 12px; text-align: left; word-wrap: break-word; white-space: pre-wrap; word-break: break-all; width: 450px;}
  tr td.line-performance, tr th.line-performance {
  text-align: left !important;
  width: 350px;
  word-wrap: break-word;
  word-break: break-all;
  padding-left: 1px !important;
}


tr td.line-type, tr th.line-type {
  text-align: left !important;
  width: 150px;
  padding-left: 1px !important;
}

tr td.line-duration, tr th.line-duration {
  background-position: left 5px top 12px;
  text-align: right  !important;
  width: 45px;
  padding-left: 1px !important;
}

tr td.line-ttfb, tr th.line-ttfb {
  background-position: left 5px top 12px;
  text-align: right  !important;
  width: 45px;
  padding-left: 1px !important;
}

.progress {
  position: relative;
  height: 13px;
  background: rgb(255, 0, 0);
  background: -moz-linear-gradient(left, rgba(0, 255, 0, 1) 0%, rgba(255, 0, 0, 1) 100%);
  background: -webkit-gradient(linear, left top, right top, color-stop(0%, rgba(0, 255, 0, 1)), color-stop(100%, rgba(255, 0, 0, 1)));
  background: -webkit-linear-gradient(left, rgba(0, 255, 0, 1) 0%, rgba(255, 0, 0, 1) 100%);
  background: -o-linear-gradient(left, rgba(0, 255, 0, 1) 0%, rgba(255, 0, 0, 1) 100%);
  background: -ms-linear-gradient(left, rgba(0, 255, 0, 1) 0%, rgba(255, 0, 0, 1) 100%);
  background: linear-gradient(to right, rgba(0, 255, 0, 1) 0%, rgba(255, 0, 0, 1) 100%);
  filter: progid: DXImageTransform.Microsoft.gradient(startColorstr='#00ff00', endColorstr='#ff0000', GradientType=1);
}
.amount {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  transition: all 0.8s;
  background: lightgray;
  /*width: 0;*/
}
.progress:before {
  content: attr(data-amount)" %";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  text-align: center;
  line-height: 13px;
  font-size: 0.8em;
}

  .mandatory {  color: #009830;}
  .mandatoryFAIL {  color: #ce3f00;}
  .download-global, .copy-section {display;none;}
  .valid-true td.line-result {color: #009830; background-image: url(../images/checkbox-checkmark.svg);}
  .valid-false td.line-result {color: #ce3f00; background-image: url(../images/action-close.svg);}
  .valid-true td.line-mandatory {  color: #009830;}
  .valid-false td.line-mandatory {  color: #ce3f00;}
  </style>
  <title>${title}</title>
  </head>
  <body class="coveo-styleguide">
  <div id="globalReport">
      <div id="scores">${scores}</div>
      <div id="legend">
        <table style='padding: 0;'>
          <tr><td><span style='font-weight:bold;color: #009830'>&#x2605;</span> Mandatory item</td></tr>
          <tr><td><span style='font-weight:bold;color: #ce3f00'>&#x2605;</span> Mandatory item, FAILED, should be corrected asap !!</td></tr>
        </table>
      </div>

      <div id="details">${details}</div>
      <div id="myscreenimage">${images}</div>
    </div>
  </body>
  </html>`;
    return html;
  }

  processDetail(section, data, tests) {
    let lines = section.attributes.map(attr => {
      let isValidCssClass = "",
        value = data[attr.key],
        hint = "";
      //Check if value is undefined, if so, make it empty string
      if (value == undefined) {
        value = "";
      }
      let additionalClass = "";
      let validColor = "";
      let validIcon = "";
      let mandatoryIcon = "";
      let mandatory = false;
      let id = "";
      if (Array.isArray(value)) {
        value = value.join("<BR>");
      }
      if (attr.additionalClass !== undefined) {
        additionalClass = attr.additionalClass;
      }
      if (attr.id !== undefined) {
        id = `${attr.id}`;
      }
      if (attr.mandatory !== undefined) {
        mandatory = true;
      }
      //Always show hints
      if (attr.hint) {
        // show hints when invalid.
        if (attr.ref) {
          hint = `${attr.hint} <a href="${attr.ref}" target="_blank">&#x2753;</a>`;
        } else {
          hint = `${attr.hint}`;
        }
      }

      if (attr.expected !== undefined) {
        let isValid = false;
        if (attr.expected.test) {
          isValid = attr.expected.test(value);
        } else {
          isValid = value === attr.expected;
        }

        if (isValid) {
          //If it should not be calculated for the total score
          if (attr.notForTotal === undefined) {
            tests.passed++;
          }
        } else {
        }

        validColor = `color: ${isValid ? "#009830" : "#ce3f00"}`;
        validIcon = `<span style="font-weight:bold;${validColor}">${
          isValid ? "&#x2713;" : "&#x2718;"
        }</span>`;

        isValidCssClass = "valid-" + isValid;
        if (mandatory) {
          mandatoryIcon = `<span class='${isValidCssClass}'>&#x2605;</span>`;
          //check if mandoatory is failed, else we need to set the flag of a total failure
          if (!isValid) {
            tests.mandatoryfail = true;
            //Add the StatusDetails
            tests.fixes += `${attr.label}: ${value}.<br><i>${hint}</i><br><br>`;
          }
        }
      }

      //If it should not be calculated for the total score
      if (attr.notForTotal === undefined) {
        tests.total++;
      }

      return `<tr class="${isValidCssClass}">
        <td class="line-mandatory">
          ${mandatoryIcon}
        </td>
        <td class="line-message">
          ${attr.label}
          <small>${hint}</small>
        </td>
        <td class="line-indicator" width="1px">${validIcon}</td>
        <td class="line-result ${additionalClass}">${id}${value}</td>
      </tr>`;
    });

    let score = this.createWheel({
      title: section.title,
      value: tests.passed,
      max: tests.total
    });

    return `<ul id="${
      section.label
    }" class="collapsible" data-collapsible="expandable">
  <li>
    <div class="copy-section" style=""></div>
    <button type="button" class="collapsible-header active btn with-icon">
      <div class="msg">
        ${section.title}
      </div>
      <div class="result" style="">${score}</div>
    </button>
    <div class="collapsible-body">
      <table><tbody>
        ${lines.join("\n")}
      </tbody></table>
    </div>
  </li>
</ul>`;
  }

  processReport(data) {
    let sections = [];
    sections = [
      {
        title: "General information",
        label: "General",
        notInMain: true,
        attributes: [
          {
            key: "name",
            label: "Org Name",
            hint: "",
            expected: { test: value => value != "" }
          },
          {
            key: "org",
            label: "Org ID",
            hint: "",
            expected: { test: value => value != "" }
          },
          {
            key: "accountName",
            label: "Account Name",
            hint: "",
            expected: { test: value => value != "" }
          },
          {
            key: "productType",
            label: "Product Type",
            hint: "",
            expected: { test: value => value != "" }
          },
          {
            key: "productEdition",
            label: "Product Edition",
            hint: "",
            expected: { test: value => value != "" }
          },
          { key: "status", label: "Status", hint: "", id: "XstatusX" },
          {
            key: "statusDetails",
            label: "Required Fixes",
            hint: "",
            id: "XstatusDetailsX"
          },
          {
            key: "version",
            label: "Org Cloud Version",
            mandatory: true,
            hint: "Use Cloud V2",
            expected: { test: value => value == "V2" }
          },
          {
            key: "uiVersion",
            label: "JS UI version",
            hint: "Should be 2.x",
            ref: "https://docs.coveo.com/en/328",
            expected: /^2\./
          },
          {
            key: "EndpointVersion",
            label: "Endpoint Version",
            mandatory: true,
            hint: "Use latest V2 endpoint",
            ref: "https://docs.coveo.com/en/288",
            expected: { test: value => value == "V2" || value == "" }
          },
          {
            key: "theDate",
            label: "Inspection Date",
            hint: "",
            expected: { test: value => value != "" }
          },
          {
            key: "docsfromsources",
            label: "Nr of Documents (M)",
            hint: "Should be <40M",
            ref: "",
            expected: {
              test: value => value < 40
            }
          },
          {
            key: "regions",
            label: "Regions deployed",
            hint: "",
            ref: ""
          },
          {
            key: "searchUrls",
            label: "Search Urls",
            hint: "From Analytics",
            ref: ""
          },
          {
            key: "accessibleUrls",
            label: "Accessible Search Urls",
            hint: "From Analytics",
            ref: ""
          },
          {
            key: "infra_machine",
            label: "Machine Size",
            hint: "AWS Machine Size",
            ref: "https://aws.amazon.com/ec2/instance-types/"
          },
          {
            key: "infra_slices",
            label: "Nr of Index-parts",
            hint: "(Slices) Default to 1, can handle 20 M documents",
            ref: "",
            expected: {
              test: value => value == 1
            }
          },
          {
            key: "infra_mem_free",
            label: "Free Memory (%)",
            mandatory: true,
            hint: "Should be at least 40%",
            ref: "",
            expected: {
              test: value => value > 40
            }
          },
          {
            key: "infra_disk_free",
            label: "Free Disk (%)",
            mandatory: true,
            hint: "Should be at least 20%",
            ref: "",
            expected: {
              test: value => value > 20
            }
          },
          {
            key: "isLive",
            label: "Is Live",
            ref: "",
            expected: true
          }
        ]
      },
      {
        title: "Content - Sources",
        label: "Sources",
        attributes: [
          {
            key: "nrofsources",
            label: "Number of Sources",
            mandatory: true,
            hint: "Should be <100.",
            ref: "",
            expected: {
              test: value => value < 100 && value > 0
            }
          },
          {
            key: "types",
            notForTotal: true,
            label: "Types of Connectors Used",
            hint: "",
            ref: ""
          },
          {
            key: "sourceWebWarning",
            mandatory: true,
            label: "Contains Web sources with to much docs (>100K)",
            hint: "Replace indexing with Sitemap or Generic REST API",
            expected: false,
            ref: "https://docs.coveo.com/en/1967"
          },
          /* { key: 'pushnames', notForTotal: true, mandatory: false, label: 'Contains Push sources', hint: '', ref: '' },*/
          {
            key: "containspush",
            notForTotal: true,
            label: "Contains Push sources",
            hint: "",
            ref: ""
          },
          {
            key: "containsonprem",
            notForTotal: true,
            label: "Contains Crawling Modules",
            hint: "",
            ref: ""
          },

          {
            key: "nrofnoschedulessources",
            mandatory: true,
            label: "Number of Sources Without Schedules",
            hint: "Enable schedules, or remove them",
            ref: "https://docs.coveo.com/en/1933",
            expected: {
              test: value => value == 0
            }
          },
          {
            key: "noscheduledsources",
            label: "Sources without schedule",
            hint: "Enable schedules, or remove them",
            ref: "https://docs.coveo.com/en/1933",
            expected: {
              test: value => value.length == 0
            }
          },
          {
            key: "numberofsecurities",
            label: "Nr of Security Indentities",
            hint: "<15.000",
            ref: "https://docs.coveo.com/en/1527",
            expected: {
              test: value => value < 15000
            }
          },
          {
            key: "securityerrors",
            label: "Nr of Security Indentity errors",
            hint: "Check your Security Identities. See Details",
            ref: "https://docs.coveo.com/en/1527",
            expected: {
              test: value => value == 0
            }
          },
          {
            key: "nrofnoscheduledsecprov",
            mandatory: true,
            label: "Number of Security providers without Refresh Schedule",
            hint: "Add security provider schedule",
            ref: "https://docs.coveo.com/en/1998",
            expected: {
              test: value => value == 0
            }
          },
          {
            key: "noscheduledsecprov",
            label: "Security providers without Refresh Schedule",
            hint: "Add security provider schedule",
            ref: "https://docs.coveo.com/en/1998",
            expected: {
              test: value => value.length == 0
            }
          }
        ]
      },
      {
        title: "Search",
        label: "Search",
        attributes: [
          {
            key: "UsingSearchAsYouType",
            mandatory: true,
            label: "Using Search As You Type",
            hint: "Search as you type will slow down performance",
            ref: "https://docs.coveo.com/en/1984",
            expected: false
          },
          {
            key: "ControlSearch",
            label: "Using Search",
            hint:
              "No of searches in the last " +
              nrofdaysAnalytics * 4 +
              " days. The % below are based upon this value.",
            ref: "",
            expected: {
              test: value => value > 0
            }
          },
          {
            key: "ControlFacet",
            mandatory: true,
            label: "% Using Facets",
            hint: "Facetted search improves user experience",
            ref: "https://docs.coveo.com/en/1984",
            expected: {
              test: value => value > 0
            }
          },
          {
            key: "ControlInterface",
            label: "% Using Different Interfaces",
            hint: "",
            ref: "https://docs.coveo.com/en/2678",
            expected: {
              test: value => value > 0
            }
          },
          {
            key: "ControlQuerySuggest",
            mandatory: true,
            label: "% Using QuerySuggest",
            hint: "Query Suggest improves user experience",
            ref: "https://docs.coveo.com/en/340",
            expected: {
              test: value => value > 5
            }
          },
          {
            key: "ControlFieldQS",
            mandatory: true,
            label: "% Using FieldQuerySuggest",
            hint: "Field Query Suggest slows down performance",
            ref: "https://docs.coveo.com/en/504",
            expected: {
              test: value => value == 0
            }
          },
          {
            key: "ControlSort",
            label: "% Using Sorting",
            hint: "",
            ref: "https://docs.coveo.com/en/1852",
            expected: {
              test: value => value > 0
            }
          },
          /*{
            key: 'ControlPaging', label: '% Using Paging', hint: '', ref: 'https://docs.coveo.com/en/1852', expected: {
              test: value => (value > 0)
            }
          },*/
          /*{
            key: 'ControlOpening', mandatory:true, label: '% Using Open/Click Result', hint: 'Should be at least 10%, are click events properly recorded?', ref: 'https://docs.coveo.com/en/1852', expected: {
              test: value => (value > 10)
            }
          },*/
          {
            key: "nrofpipelines",
            mandatory: true,
            label: "Nr of Query Pipelines",
            hint: "Should be at least 2, not more than 15",
            ref: "https://docs.coveo.com/en/1791",
            expected: {
              test: value => value >= 2 && value <= 15
            }
          },
          {
            key: "nrofqpl_with_filters",
            mandatory: true,
            label: "Number of Pipelines with a filter",
            hint:
              "If you are using a filter to restrict the scope, make sure the searchtoken contains the querypipeline.",
            ref: "https://docs.coveo.com/en/56",
            expected: {
              test: value => value == 0
            }
          },
          {
            key: "qpl_with_filters",
            label: "Pipelines with a filter",
            hint:
              "If you are using a filter to restrict the scope, make sure the searchtoken contains the querypipeline.",
            ref: "https://docs.coveo.com/en/56",
            expected: {
              test: value => value.length == 0
            }
          },
          {
            key: "models_platformVersion",
            label: "Machine Learning, Platform Version",
            hint: "Use Machine Learning, latest version",
            ref: "https://docs.coveo.com/en/2816",
            expected: 2
          },
          {
            key: "usedPipelines",
            label: "Used Pipelines",
            hint: "Pipelines used in search",
            ref: "https://docs.coveo.com/en/56",
            expected: {
              test: value => value.length > 0
            }
          },
          {
            key: "MLModels",
            label: "Used ML Models",
            hint: "Models associated to Pipelines used in search",
            ref: "https://docs.coveo.com/en/56",
            expected: {
              test: value => value.length > 0
            }
          },
          {
            key: "mlquerysuggest",
            mandatory: true,
            label: "Machine Learning, Query Suggest Enabled",
            hint: "Use Machine Learning, Query Suggest. See Details",
            ref: "https://docs.coveo.com/en/1838",
            expected: true
          },
          {
            key: "mlart",
            mandatory: true,
            label: "Machine Learning, Relevancy Tuning Enabled",
            hint:
              "Use Machine Learning, Automatic Relevancy Tuning. See Details",
            ref: "https://docs.coveo.com/en/1519",
            expected: true
          },
          {
            key: "mlrecommendation",
            label: "Machine Learning, Recommendations Enabled",
            hint: "Use Machine Learning, Recommendations. See Details",
            ref: "https://docs.coveo.com/en/1573",
            expected: true
          },
          {
            key: "mldne",
            label: "Machine Learning, Dynamic Navigation Enabled",
            hint: "Use Machine Learning, Dynamic Navigation. See Details",
            ref: "https://docs.coveo.com/en/2816",
            expected: true
          },
          {
            key: "nrofthesaurus",
            label: "Nr of Thesaurus entries",
            hint: "Do not use more than 500",
            ref: "https://docs.coveo.com/en/1738",
            expected: {
              test: value => value < 500
            }
          },
          {
            key: "nrofqre",
            label: "Nr of Ranking Expressions",
            hint: "The more, the harder to manage, ranking will suffer",
            ref: "https://docs.coveo.com/en/1690",
            expected: {
              test: value => value <= 50
            }
          },
          {
            key: "nroffeatured",
            label: "Nr of Featured Results",
            hint: "The more, the harder to manage",
            ref: "https://docs.coveo.com/en/1961",
            expected: {
              test: value => value <= 50
            }
          }
        ]
      },
      {
        title: "Analytics",
        label: "Analytics",
        attributes: [
          {
            key: "det_analyticsSent",
            label: "Analytics Sent",
            hint: "Search & Open document Analytics calls should be present",
            mandatory: true,
            ref: "",
            expected: true
          },
          {
            key: "EmptyHubs",
            label: "Empty Hubs",
            hint: "Make sure you set the OriginLevel1 in your calls",
            mandatory: true,
            ref: "",
            expected: false
          },
          {
            key: "UniqueVisit",
            label: "Nr of Unique Visits",
            mandatory: true,
            hint:
              "Make sure search is still enabled in the last " +
              nrofdaysAnalytics +
              " days",
            ref: "",
            expected: {
              test: value => value > 1000
            }
          },
          {
            key: "PerformSearch",
            label: "Nr of Searches",
            hint: "Last " + nrofdaysAnalytics + " days",
            ref: ""
          },
          {
            key: "SearchWithClick",
            label: "Nr of Searches with click",
            hint: "Last " + nrofdaysAnalytics + " days",
            ref: "",
            expected: {
              test: value => value > 10000
            }
          },
          {
            key: "ClickThroughRatio",
            label: "Click Through Ratio (%)",
            mandatory: true,
            hint: "Should be > 50%, in the Last " + nrofdaysAnalytics + " days",
            ref: "https://docs.coveo.com/en/2041",
            expected: {
              test: value => value > 50
            }
          },
          {
            key: "AverageClickRank",
            label: "Click Rank",
            mandatory: true,
            hint: "Should be <3, in the last " + nrofdaysAnalytics + " days",
            ref: "https://docs.coveo.com/en/2041",
            expected: {
              test: value => value < 3
            }
          },
          {
            key: "RefinementQuery",
            label: "Nr of Refinement Searches",
            hint: "Last " + nrofdaysAnalytics + " days",
            ref: ""
          },
          {
            key: "DocumentView",
            label: "Nr of Document Views",
            hint: "Last " + nrofdaysAnalytics + " days",
            ref: ""
          },
          {
            key: "AvgResponse",
            label: "Avg Response Time",
            mandatory: true,
            hint: "Should be <500, in the last " + nrofdaysAnalytics + " days",
            ref: "https://docs.coveo.com/en/1948",
            expected: {
              test: value => value < 500
            }
          }
        ]
      }
    ];

    let sectionCharts = [];
    let html = [];
    let allFixes = "";
    sections.forEach(section => {
      let tests = { passed: 0, total: 0, mandatoryfail: false, fixes: "" };

      html.push(this.processDetail(section, data, tests));
      if (tests.fixes != "") {
        allFixes += tests.fixes;
      }
      let subtitle = '<BR><span style="color: #009830;">PASSED</span>';
      data["Score_" + section.label] = "PASSED";
      if (tests.mandatoryfail) {
        data["Score_" + section.label] = "FAILED";
        subtitle = '<BR><span style="color: #ce3f00;">FAILED</span>';
      }
      if (section.notInMain === undefined) {
        sectionCharts.push({
          title: section.label,
          subtitle: subtitle,
          value: tests.passed,
          max: tests.total
        });
      }
    });
    //Add details_ml to fixes
    if (data.details_ml != "") {
      allFixes =
        "<h4>Search - Machine Learning Models which need attention:</h4>" +
        data.details_ml;
    }
    data.statusDetails = allFixes;
    let scores = sectionCharts.map(this.createWheel);
    let maintitle =
      "Organization Report<br>" +
      '<a href="' +
      this.baseUrl +
      "/admin/#" +
      data.org +
      '" target="_blank">' +
      data.name +
      "</a>";

    //document.getElementById('scores').innerHTML = '<h2>' + maintitle + '</h2>' + scores.join('\n');
    /*
        if (data.errors != "" && data.errors !== undefined) {

          data.details += "<hr><h4 style='color: red;  font-size: 20px;'>Errors during processing:</h4>" + data.errors;
        }
        if (data.badquery != "") {

          data.details += "<hr><h4 style='color:red'>Queries which need attention:</h4>" + data.badquery + "";
        }
        if (data.details_facettolong != "") {

          data.details += "<hr><h4>Facet values which are too long:</h4>" + data.details_facettolong;
        }
        if (data.details_alwaysthesame != "") {

          data.details += "<hr><h4>Fields where the end of the content is the same:</h4>" + data.details_alwaysthesame;
        }
        */
    if (data.details_ml != "") {
      data.details +=
        "<hr><h4>Search - Machine Learning Models which need attention:</h4>" +
        data.details_ml;
    }
    if (data.details_pipelines != "") {
      data.details +=
        "<hr><h4>Search - Query Pipelines which need attention:</h4>" +
        data.details_pipelines;
    }
    if (data.usagedetails != "" && data.usagedetails !== undefined) {
      data.details = data.usagedetails + "<br>" + data.details;
    }
    let details = `<ul id="Details" class="collapsible" data-collapsible="expandable">
  <li>
      <button type="button" class="collapsible-header active btn with-icon">
          <div class="msg">
            Details
          </div>
      </button>
      <div class="collapsible-body">
        <table><tbody><tr><td style='padding-left: 1px;max-width: 780px;word-break: break-word;'>
          ${data.details}
        </tbody></td></tr></table>
      </div>
  </li>
  </ul>`;
    //document.getElementById('details').innerHTML = html.join('\n') + details;
    let images = "";
    data.thesearchurl.map(urls => {
      images += `<img src="data:image/gif;base64,${this.getImage64(
        "results/" + urls.img + ".png"
      )}"/><br>`;
      images +=
        'Open search page: <a target="_blank" href="' +
        urls.searchurl +
        '">Open</a><br><br>';
    });
    let fullhtml = html.join("\n");
    //We need to insert the fixes afterwards
    fullhtml = fullhtml.replace("XstatusDetailsX", allFixes);
    if (allFixes != "") {
      fullhtml = fullhtml.replace("XstatusX", "Intervention Required");
      data.status = "Intervention Required";
    } else {
      fullhtml = fullhtml.replace("XstatusX", "OK");
      data.status = "OK";
    }
    return this.getHTML(
      maintitle,
      "<h2>" + maintitle + "</h2>" + scores.join("\n"),
      fullhtml + details,
      images
    );
  }

  async executeCall(url, report, title, err, typeReq, auth, fd) {
    const callApi = require("./callApi");
    const data = [];
    const options = {
      url: url,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + auth
      }
    };
    return callApi(options, data).then(response => {
      if (response.response.statusCode == 200) {
        return JSON.parse(response.body);
      } else {
        //let parsedBody = JSON.parse(response.body);
        if (debug) {
          console.log("ERROR CALL:");
          console.log(url);
          console.log(response);
        }
        return undefined;
      }
    });
  }

  getSourceInfo(report) {
    let url = this.baseUrl + "/rest/organizations/" + report.org + "/sources";
    let sources = 0;
    let disabled = 0;
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Source Info",
        "thereAreErrorsSources",
        "GET",
        this.apiKey
      ).then(function(data) {
        try {
          if (data) {
            const utils = require("./utils");
            report.docsfromsources = 0;
            if (report.version == "V2") {
              report.nrofsources = data.length;
              let sourceTypes = data.map(source => source.sourceType);
              report.types = [...new Set(sourceTypes)].sort(
                utils.caseInsensitiveSort
              );
              //console.log(report.types);
              report.pushnames = data.filter(source => {
                if (source.pushEnabled || source.sourceType == "SITECORE")
                  return source.id;
              });
              report.containsonprem =
                data.filter(source => {
                  if (source.onPremisesEnabled) return source.name;
                }).length > 0;
              report.containspush =
                data.filter(source => {
                  if (source.pushEnabled) return source.name;
                }).length > 0;
              report.details += "<hr><h4>Source Information:</h4>";
              report.details +=
                "<table><tr><th><b>Source</b></th><th style='text-align:right'><b>Nr of Docs</b></th></tr>";
              data.map(source => {
                //Check for Websources
                if (
                  source.sourceType == "WEB2" &&
                  source.information.numberOfDocuments > 100000
                ) {
                  report.sourceWebWarning = true;
                }
                report.docsfromsources += source.information.numberOfDocuments;
                report.details +=
                  "<tr><td>" +
                  source.id +
                  "</td><td style='text-align:right'>" +
                  source.information.numberOfDocuments.toLocaleString() +
                  "</td></tr>";
              });
              report.details += "</table>";
              report.sourceids = data.map(source => {
                let obj = { id: source.id, name: source.name };
                return obj;
              });
            } else {
              report.nrofsources = data.sources.length;
              let sourceTypes = data.sources.map(source => source.type);
              report.types = [...new Set(sourceTypes)].sort(
                utils.caseInsensitiveSort
              );
              report.pushnames = [];
              report.containsonprem = false;
              report.containspush = false;
              report.details += "<hr><h4>Source Information:</h4>";
              report.details +=
                "<table><tr><th><b>Source</b></th><th style='text-align:right'><b>Nr of Docs</b></th></tr>";
              data.sources.map(source => {
                report.docsfromsources += source.numberOfDocuments;
                report.details +=
                  "<tr><td>" +
                  source.id +
                  "</td><td style='text-align:right'>" +
                  source.numberOfDocuments.toLocaleString() +
                  "</td></tr>";
              });
              report.details += "</table>";
              report.sourceids = data.sources.map(source => {
                let obj = { id: source.id, name: source.name };
                return obj;
              });
            }
            report.docsfromsourcesClean = report.docsfromsources.toFixed(0);
            report.docsfromsources = (report.docsfromsources / 1000000).toFixed(
              2
            );
          }
        } catch {}
        resolve(report);
      });
    });
    return promise;
  }

  getSourceSchedules(report, id) {
    let url =
      this.baseUrl +
      escape(
        "/rest/organizations/" + report.org + "/sources/" + id + "/schedules"
      );
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Source Schedules Info",
        "thereAreErrorsSources",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (debug) {
          console.log("In Get Source Schedules");
          console.log(data);
        }
        if (data) {
          resolve(data.length != 0);
        } else {
          resolve(false);
        }
      });
    });
    return promise;
  }

  getNodeInfo(report) {
    let url = this.baseUrl + "/rest/organizations/" + report.org + "/indexes";
    let promise = new Promise(resolve => {
      if (report.version == "V2") {
        this.executeCall(
          url,
          report,
          "Getting Organization Info",
          "thereAreErrorsOrg",
          "GET",
          this.apiKey
        ).then(function(data) {
          if (data) {
            try {
              report.infra_machine = data[0].machineSpec.architecture;
              report.infra_storage =
                data[0].machineSpec.storageSpec.storageType;
              report.infra_storage_size =
                data[0].machineSpec.storageSpec.sizeInGigabytes;
              report.infra_slices = data[0].status.stats.numberOfSlices;
              report.infra_indexes = data.length;
              report.infra_mem_free = Math.round(
                100 -
                  data[0].status.stats.totalMemoryUsed /
                    (data[0].status.stats.totalPhysicalMemory / 100)
              );
              report.infra_disk_free = Math.round(
                100 -
                  data[0].status.stats.diskSpaceUsed /
                    ((data[0].status.stats.diskSpaceUsed +
                      data[0].status.stats.remainingDiskSpace) /
                      100)
              );
            } catch {}
          }
          resolve(report);
        });
      } else {
        resolve(report);
      }
    });
    return promise;
  }

  getSecProvSchedules(report, id) {
    let url =
      this.baseUrl +
      escape(
        "/rest/organizations/" +
          report.org +
          "/securityproviders/" +
          id +
          "/schedules"
      );
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Security Providers Schedules Info",
        "thereAreErrorsSources",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data) {
          resolve(data.length != 0);
        } else {
          resolve(false);
        }
      });
    });
    return promise;
  }

  getSecurityInfo(report) {
    let url =
      this.baseUrl + "/rest/organizations/" + report.org + "/securityproviders";
    let requests = [];
    let promise = new Promise(resolve => {
      if (report.version == "V2") {
        this.executeCall(
          url,
          report,
          "Getting Security Providers Info",
          "thereAreErrorsSources",
          "GET",
          this.apiKey
        ).then(function(data) {
          if (data && data.map) {
            try {
              report.securityerrors = data.filter(sec => {
                if (sec.statistics.numberOfEntitiesInError > 0) return sec.name;
              }).length;
              data.map(sec => {
                report.numberofsecurities +=
                  sec.statistics.totalNumberOfEntities;
              });
              if (report.securityerrors > 0) {
                report.details +=
                  "<hr><h4>Security Identity Providers with errors:</h4>";
                data
                  .filter(sec => {
                    if (sec.statistics.numberOfEntitiesInError > 0)
                      return sec.name;
                  })
                  .map(sec => {
                    report.details +=
                      sec.name +
                      ": <b>" +
                      sec.statistics.numberOfEntitiesInError +
                      "</b> errors<BR>";
                  });
              }
              requests = data.map(sec => {
                if (sec.type == "EMAIL" || sec.type == "EXPANDED") {
                } else {
                  return new Promise(resolve => {
                    inspect
                      .getSecProvSchedules(report, sec.id)
                      .then(function(datas) {
                        if (!datas) {
                          report.noscheduledsecprov.push(sec.name);
                        } else {
                          if (data.map) {
                            let enabled = false;
                            data.map(sec => {
                              if (sec.enabled) enabled = true;
                            });
                            if (!enabled) {
                              report.noscheduledsecprov.push(sec.name);
                            }
                          }
                        }
                        resolve();
                      });
                  });
                }
              });
            } catch {}
          }
          //Execute the requests
          Promise.all(requests).then(() => {
            resolve(report);
          });
        });
      } else {
        resolve(report);
      }
    });
    return promise;
  }

  getExtensionInfo(report) {
    let url =
      this.baseUrl + "/rest/organizations/" + report.org + "/extensions";
    let promise = new Promise(resolve => {
      const utils = require("./utils");
      if (report.version == "V2") {
        this.executeCall(
          url,
          report,
          "Getting Extensions Info",
          "thereAreErrorsExtensions",
          "GET",
          this.apiKey
        ).then(function(data) {
          if (data && data.map) {
            report.nrofextensions = data.length;
            report.disabledextensions = data
              .filter(source => {
                if (!source.enabled) return source.name;
              })
              .map(source => source.name)
              .sort(utils.caseInsensitiveSort);
            report.nrofdisabledextensions = report.disabledextensions.length;
            report.nrslowextensions = data.filter(source => {
              if (source.status.dailyStatistics.averageDurationInSeconds > 1)
                return source.name;
            }).length;
            report.nrerrorextensions = data.filter(source => {
              if (source.status.dailyStatistics.numberOfErrors > 0)
                return source.name;
            }).length;
            report.nrtimeoutextensions = data.filter(source => {
              if (source.status.dailyStatistics.numberOfTimeouts > 5)
                return source.name;
            }).length;
            report.slowextensions = data
              .filter(source => {
                if (source.status.dailyStatistics.averageDurationInSeconds > 1)
                  return source.name;
              })
              .map(source => source.name)
              .sort(utils.caseInsensitiveSort);
            report.timeoutextensions = data
              .filter(source => {
                if (source.status.dailyStatistics.numberOfTimeouts > 5)
                  return source.name;
              })
              .map(source => source.name)
              .sort(utils.caseInsensitiveSort);
            report.errorextensions = data
              .filter(source => {
                if (source.status.dailyStatistics.numberOfErrors > 0)
                  return source.name;
              })
              .map(source => source.name)
              .sort(utils.caseInsensitiveSort);
            if (
              data.filter(source => {
                if (source.status.dailyStatistics.averageDurationInSeconds > 0)
                  return source.name;
              }).length > 0
            ) {
              report.details +=
                "<hr><h4>Average execution time Extensions:</h4>";
              data
                .filter(source => {
                  if (
                    source.status.dailyStatistics.averageDurationInSeconds > 0
                  )
                    return source.name;
                })
                .map(source => {
                  report.details +=
                    source.id +
                    ": <b>" +
                    source.status.dailyStatistics.averageDurationInSeconds.toFixed(
                      2
                    ) +
                    "</b> seconds<BR>";
                });
            }
          }
          resolve(report);
        });
      } else {
        resolve(report);
      }
    });
    return promise;
  }

  getAnalyticsMetricsInfo(report) {
    var now = new Date();
    var from = new Date();
    from = from.setDate(now.getDate() - nrofdaysAnalytics);
    var fromlast = new Date(from);
    var to = new Date();

    let froms = "&from=" + fromlast.toISOString() + "&to=" + to.toISOString();
    let url =
      this.baseUrlAnalytics +
      "/rest/ua/v15/stats/globalData?m=PerformSearch&m=RefinementQuery&m=average%28actionresponsetime%29&m=UniqueVisitorById&m=UniqueVisit&m=DocumentView&m=AverageClickRank&m=ClickThroughRatio&m=SearchWithClick&tz=Z&i=DAY&bindOnLastSearch=false&org=" +
      report.org +
      froms;
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Analtyics Metrics Info",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (debug) {
          console.log(data);
        }
        if (data) {
          report.UniqueVisit = data.globalDatas.UniqueVisit.value;

          report.PerformSearch = data.globalDatas.PerformSearch.total;
          report.SearchWithClick = data.globalDatas.SearchWithClick.total;
          report.ClickThroughRatio = (
            data.globalDatas.ClickThroughRatio.value * 100
          ).toFixed(2);
          report.AverageClickRank = data.globalDatas.AverageClickRank.value.toFixed(
            2
          );
          report.RefinementQuery = data.globalDatas.RefinementQuery.total;
          report.DocumentView = data.globalDatas.DocumentView.total;
          report.AvgResponse =
            data.globalDatas["average(actionresponsetime)"].value;
          if (report.PerformSearch > 0 && report.DocumentView > 0) {
            report.det_analyticsSent = true;
          }
        }
        resolve(report);
      });
    });
    return promise;
  }

  getModelsInfo(report) {
    let url =
      this.baseUrl +
      "/rest/organizations/" +
      report.org +
      "/machinelearning/models";
    report.models_platformVersion = 1;
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting ML Models Info",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data && data.map) {
          report.models = data;
          if (data[0] != undefined) {
            report.models_platformVersion = data[0].platformVersion;
          }
        }
        resolve(report);
      });
    });
    return promise;
  }

  getLicense(report) {
    let url = this.baseUrl + "/rest/organizations/" + report.org + "/license";
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting License Info",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data) {
          if (debug) {
            console.log(data);
          }
          report.productEdition = data.productName + "_" + data.productEdition;
          report.productType = data.productType;
          report.accountName = data.accountName;
          report.accountId = data.accountId;
          if (data.properties.internal != undefined) {
            if (
              data.properties.internal.defaultInstanceArchitecture != undefined
            ) {
              report.infra_machine =
                data.properties.internal.defaultInstanceArchitecture;
            }
            if (data.properties.internal.activatedRegions != undefined) {
              report.regions = data.properties.internal.activatedRegions;
            }
          }
        }
        resolve(report);
      });
    });
    return promise;
  }

  getQueryPipelinesInfo(report) {
    let url =
      this.baseUrl +
      "/rest/search/admin/pipelines/?organizationId=" +
      report.org;
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Query Pipelines Info",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data && data.map) {
          report.nrofpipelines = data.length;
          report.pipelines = data;
        }
        resolve(report);
      });
    });
    return promise;
  }

  getMLModels(report) {
    let url =
      this.baseUrl +
      "/rest/organizations/" +
      report.org +
      "/machinelearning/models/details";
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting ML Models ",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data) {
          let models = [];
          data.map(model => {
            let count = 0;
            if ("totalQueries" in model.info) {
              count = model.info["totalQueries"];
            }
            if ("candidates" in model.info) {
              count = model.info["candidates"];
            }
            if ("primaryIdToValue" in model.info) {
              count = model.info["primaryIdToValue"];
            }
            models.push({ name: model.modelDisplayName, count: count });
          });
          if (debug) {
            console.log(models);
          }
          report.MLModelsInfo = models;
          resolve(report);
        } else {
          resolve(report);
        }
      });
    });
    return promise;
  }

  getQueryPipelinesDetailsResults(report, id, type) {
    let url =
      this.baseUrl +
      escape("/rest/search/admin/pipelines/" + id + "/statements") +
      "?organizationId=" +
      report.org +
      "&feature=" +
      type +
      "&perPage=200";
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Query Pipeline Details for " + type,
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data) {
          resolve(data);
        } else {
          resolve(undefined);
        }
      });
    });
    return promise;
  }

  getQueryPipelinesDetailsResultsV2(report, id) {
    let url =
      this.baseUrl +
      escape(
        "/rest/search/v2/admin/pipelines/" + id + "/ml/model/associations"
      ) +
      "?organizationId=" +
      report.org +
      "&perPage=200";
    let promise = new Promise(resolve => {
      this.executeCall(
        url,
        report,
        "Getting Query Pipeline Details ",
        "thereAreErrorsSearch",
        "GET",
        this.apiKey
      ).then(function(data) {
        if (data) {
          resolve(data);
        } else {
          resolve(undefined);
        }
      });
    });
    return promise;
  }

  checkProperML(checkmodel, report, models, indicator) {
    let result = true;
    models.map(model => {
      if (model.name == checkmodel) {
        //Check if this one is present in MLModelsInfo, if so check count (>10)
        if (model.count <= 10) {
          result = false;
        }
      }
    });
    if (!result) {
      report[indicator] = false;
      if (report.details_ml.indexOf(checkmodel) == -1) {
        report.details_ml += "<BR><BR>ML Model: <b>" + checkmodel + "</b><BR>";
        report.details_ml +=
          "Machine Learning, is not learning. Check your ML Configuration.<BR>";
      }
    }
    return report;
  }

  addPipeLineModels(json, report, indicator) {
    json.statements.map(model => {
      let name = model.displayName;
      if (name==undefined){
         name = model.modelName;
      }
      report.MLModels.push(name);
      //Check if this one is present in MLModelsInfo, if so check count (>10)
      report = inspect.checkProperML(
        name,
        report,
        report.MLModelsInfo,
        indicator
      );
    });
    return report;
  }

  getQueryPipelinesDetails(json, pipe) {
    //First get Models
    //If models platformVersion==1 use the below
    let QuerySuggest, Recommendation, Ranking;
    if (json.models_platformVersion == 1) {
      QuerySuggest = new Promise(resolve => {
        this.getQueryPipelinesDetailsResults(
          json,
          pipe.id,
          "querySuggest"
        ).then(function(data) {
          if (json.details_pipelines.indexOf(pipe.name) == -1) {
            json.details_pipelines +=
              "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
            json.details_pipelines +=
              "Machine Learning, using old version, consider upgrading to the latest (platformVersion 2).<BR>";
          }
          if (debug) {
            console.log("Get Query Suggest data:");
            console.log(data);
          }
          if (data) {
            if (data.totalCount == 0) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Query Suggestions not enabled.<BR>";
              json.mlquerysuggest = false;
            } else {
              json = inspect.addPipeLineModels(data, json, "mlquerysuggest");
            }
          }
          resolve();
        });
      });
      Recommendation = new Promise(resolve => {
        this.getQueryPipelinesDetailsResults(
          json,
          pipe.id,
          "recommendation"
        ).then(function(data) {
          if (json.details_pipelines.indexOf(pipe.name) == -1) {
            json.details_pipelines +=
              "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
            json.details_pipelines +=
              "Machine Learning, using old version, consider upgrading to the latest (platformVersion 2).<BR>";
          }
          if (debug) {
            console.log("Get Recommendation data:");
            console.log(data);
          }
          if (data) {
            if (data.totalCount == 0) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Recommendations not enabled.<BR>";
              json.mlrecommendation = false;
            } else {
              json = inspect.addPipeLineModels(data, json, "mlrecommendation");
            }
          }
          resolve();
        });
      });
      Ranking = new Promise(resolve => {
        this.getQueryPipelinesDetailsResults(json, pipe.id, "topClicks").then(
          function(data) {
            if (json.details_pipelines.indexOf(pipe.name) == -1) {
              json.details_pipelines +=
                "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              json.details_pipelines +=
                "Machine Learning, using old version, consider upgrading to the latest (platformVersion 2).<BR>";
            }
            if (debug) {
              console.log("Get ART data:");
              console.log(data);
            }
            if (data) {
              if (data.totalCount == 0) {
                if (json.details_pipelines.indexOf(pipe.name) == -1) {
                  json.details_pipelines +=
                    "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
                }
                json.details_pipelines +=
                  "Machine Learning, Automatic Relevancy Tuning not enabled.<BR>";
                json.mlart = false;
              } else {
                json = inspect.addPipeLineModels(data, json, "mlart");
              }
            }
            resolve();
          }
        );
      });
    } else {
      //Use the new platform V2 calls to retrieve the associations to the ML
      QuerySuggest = new Promise(resolve => {
        this.getQueryPipelinesDetailsResultsV2(json, pipe.id).then(function(
          data
        ) {
          if (data) {
            if (data.totalEntries == 0) {
              json.mlquerysuggest = false;
              json.mlart = false;
              json.mlrecommendation = false;
              json.mldne = false;
            } else {
              data.rules.map(model => {
                let name = model.modelDisplayName;
                if (name==undefined){
                  name = model.modelName;
                }
                json.MLModels.push(name);
                if (model.modelStatus == "ONLINE") {
                  if (model.modelId.indexOf("_topclicks_") != -1) {
                    json.mlart = true;
                    json = inspect.checkProperML(
                      name,
                      json,
                      json.MLModelsInfo,
                      "mlart"
                    );
                  }
                  if (model.modelId.indexOf("_facetsense_") != -1) {
                    json.mldne = true;
                    json = inspect.checkProperML(
                      name,
                      json,
                      json.MLModelsInfo,
                      "mldne"
                    );
                  }
                  if (model.modelId.indexOf("_eventrecommendation_") != -1) {
                    json.mlrecommendation = true;
                    json = inspect.checkProperML(
                      name,
                      json,
                      json.MLModelsInfo,
                      "mlrecommendation"
                    );
                  }
                  if (model.modelId.indexOf("_querysuggest_") != -1) {
                    json.mlquerysuggest = true;
                    json = inspect.checkProperML(
                      name,
                      json,
                      json.MLModelsInfo,
                      "mlquerysuggest"
                    );
                  }
                }
              });
            }
            if (!json.mlquerysuggest) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Query Suggestions not enabled.<BR>";
            }
            if (!json.mlart) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Automatic Relevancy Tuning not enabled.<BR>";
            }
            if (!json.mlrecommendation) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Recommendations not enabled.<BR>";
            }
            if (!json.mldne) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Machine Learning, Dynamic Navigation not enabled.<BR>";
            }
          }
          resolve();
        });
      });
    }
    let Featured = new Promise(resolve => {
      this.getQueryPipelinesDetailsResults(json, pipe.id, "top").then(function(
        data
      ) {
        if (data) {
          if (data.totalCount > 50) {
            if (json.details_pipelines.indexOf(pipe.name) == -1) {
              json.details_pipelines +=
                "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
            }
            json.details_pipelines +=
              "Too many (" + data.totalCount + ") Featured results (>50).<BR>";
          }
          json.nroffeatured += data.totalCount;
        }
        resolve();
      });
    });
    let Filter = new Promise(resolve => {
      this.getQueryPipelinesDetailsResults(json, pipe.id, "filter").then(
        function(data) {
          if (data) {
            data.statements.map(statement => {
              json.qpl_with_filters.push(pipe.name);
            });
          }
          resolve();
        }
      );
    });
    let QRE = new Promise(resolve => {
      this.getQueryPipelinesDetailsResults(json, pipe.id, "ranking").then(
        function(data) {
          if (data) {
            if (data.totalCount > 50) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Too many (" +
                data.totalCount +
                ") Ranking Expressions (>50).<BR>";
            }
            data.statements.map(statement => {});
            json.nrofqre += data.totalCount;
          }
          resolve();
        }
      );
    });
    let Thesaurus = new Promise(resolve => {
      this.getQueryPipelinesDetailsResults(json, pipe.id, "thesaurus").then(
        function(data) {
          if (data) {
            if (data.totalCount > 500) {
              if (json.details_pipelines.indexOf(pipe.name) == -1) {
                json.details_pipelines +=
                  "<BR><BR>Pipeline: <b>" + pipe.name + "</b><BR>";
              }
              json.details_pipelines +=
                "Too many (" +
                data.totalCount +
                ") Thesaurus entries (>500).<BR>";
            }
            json.nrofthesaurus += data.totalCount;
          }
          resolve();
        }
      );
    });
    //return json;
    if (json.models_platformVersion == 1) {
      if (debug) {
        console.log("Adding Promises for QPL");
      }
      return QuerySuggest.then(Recommendation)
        .then(Ranking)
        .then(Featured)
        .then(Filter)
        .then(QRE)
        .then(Thesaurus);
    } else {
      return QuerySuggest.then(Featured)
        .then(Filter)
        .then(QRE)
        .then(Thesaurus);
    }
  }

  sleeper(ms) {
    return function(x) {
      return new Promise(resolve => setTimeout(() => resolve(x), ms));
    };
  }

  executeSequentially(tasks) {
    return tasks.reduce(function(sequence, curPromise) {
      // Use reduce to chain the promises together
      return sequence.then(inspect.sleeper(300)).then(function() {
        return curPromise;
      });
    }, Promise.resolve());
  }

  getHost(url) {
    // run against regex
    const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
    // extract hostname (will be null if no match is found)
    return matches && matches[1];
  }

  async createScreenshot(url, file) {
    const page = await browser.newPage();
    try {
      if (debug) {
        console.log("Creating screenshot: " + url);
      }

      page.on("error", msg => {
        throw msg;
      });
      //Set proper resolution
      await page.setViewport({
        width: 1920,
        height: 1580,
        deviceScaleFactor: 1
      });
      let moveOn = false;

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000
      });
      //Check if no redirect
      const pageurl = this.getHost(page.url());
      if (this.getHost(url).includes(pageurl)) {
        moveOn = true;
      }
      if (moveOn) {
       // console.log("HERE1");
        let data = await page.evaluate(() => {
          //console.log("HERE2");
          let all = {};
          //Calculate score based upon coveo components in the page
          //If it contains facets: highest score
          //If it contains results: mid score
          //If it contains Coveo components: lowest
          //If it does not contain anything: score=1, simply take a screenshot
          all.coveo = document.querySelectorAll('[class^="Coveo"]').length;
          all.results = document.querySelectorAll(".CoveoResult").length;
          all.facets = document.querySelectorAll(
            ".coveo-facet-selectable"
          ).length;
          
          let hasSearchAsYoutype = false;
          try {
            var boxes = Coveo.$(".CoveoSearchbox");
            var counter = 0;

            boxes.map(box => {
              if (
                Coveo.$(".CoveoSearchbox")[counter].getAttribute(
                  "data-enable-search-as-you-type"
                ) == "true"
              ) {
                hasSearchAsYoutype = true;
              }
              counter++;
            });
          } catch (ex2) {
            /*if (debug) {
              console.log(ex2.message);
            }*/
          }
          
          all.uiVersion = "";
          try {
            all.uiVersion = Coveo.version.lib;
          } catch (ex) {
            /*if (debug) {
              console.log(ex.message);
            }*/
          }
          all.EndpointVersion = "";
          try {
            all.EndpointVersion = Coveo.SearchEndpoint.endpoints.default.options.version.toUpperCase();
          } catch (ex) {
            /*if (debug) {
              console.log(ex.message);
            }*/
          }
          try {
            all.EndpointVersion = Coveo.Rest.SearchEndpoint.endpoints.default.options.version.toUpperCase();
          } catch (ex) {
            /*if (debug) {
              console.log(ex.message);
            }*/
          }
          all.score = 1;
          all.img = "";
          all.url = "";
          all.hash = 0;
          all.containsSearchAsYouType = hasSearchAsYoutype;
          
          if (all.facets > 3) {
            all.score = 10;
          } else {
            if (all.results > 3) {
              all.score = 5;
            } else {
              if (all.coveo > 3) {
                all.score = 2;
              }
            }
          }
          return all;
        });
        if (debug) {
          console.log("Number of Coveo occurences: " + JSON.stringify(data));
        }
        if (data.score > 0) {
          data.img = file;
          data.url = url;
          await page.screenshot({ path: "results/" + data.img + ".png" }); //, () => {
          if (debug) {
            console.log(
              "Created shot: " +
                "results/" +
                data.img +
                ".png => Score: " +
                data.score
            );
          }
          //Calculate hash to compare the same images
          await this.myimageHash("results/" + data.img + ".png").then(function(
            mydata
          ) {
            data.hash = mydata;
          });
          return data;
          //});
        } else {
          let all = {};
          all.score = 0;
          return all;
        }
      } else {
        let all = {};
        all.score = 0;
        return all;
      }
    } catch (e) {
      if (debug) console.log(e);
      let all = {};
      all.score = 0;
      return all;
    } finally {
      await page.close();
    }
    //});
    //return promise;
  }

  async createScreenshotMobile(url, file) {
    const page = await browser.newPage();
    try {
      if (debug) {
        console.log("Creating screenshot: " + url);
      }

      page.on("error", msg => {
        throw msg;
      });
      //Set proper resolution
      await page.setViewport({
        width: 360,
        height: 740,
        deviceScaleFactor: 1
      });
      let moveOn = false;

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000
      });
      //Check if no redirect
      const pageurl = this.getHost(page.url());
      if (this.getHost(url).includes(pageurl)) {
        moveOn = true;
      }
      if (moveOn) {
        let data = await page.evaluate(() => {
          let all = {};
          //Calculate score based upon coveo components in the page
          //If it contains facets: highest score
          //If it contains results: mid score
          //If it contains Coveo components: lowest
          //If it does not contain anything: score=1, simply take a screenshot
          all.coveo = document.querySelectorAll('[class^="Coveo"]').length;
          all.results = document.querySelectorAll(".CoveoResult").length;
          all.facets = document.querySelectorAll(
            ".coveo-facet-selectable"
          ).length;
          let hasSearchAsYoutype = false;
          try {
            var boxes = Coveo.$(".CoveoSearchbox");
            var counter = 0;

            boxes.map(box => {
              if (
                Coveo.$(".CoveoSearchbox")[counter].getAttribute(
                  "data-enable-search-as-you-type"
                ) == "true"
              ) {
                hasSearchAsYoutype = true;
              }
              counter++;
            });
          } catch (ex2) {
            //if (debug) console.log(ex2.message);
          }
          all.uiVersion = "";
          try {
            all.uiVersion = Coveo.version.lib;
          } catch (ex) {
            //if (debug) console.log(ex.message);
          }
          all.EndpointVersion = "";
          try {
            all.EndpointVersion = Coveo.SearchEndpoint.endpoints.default.options.version.toUpperCase();
          } catch (ex) {
            //if (debug) console.log(ex.message);
          }
          try {
            all.EndpointVersion = Coveo.Rest.SearchEndpoint.endpoints.default.options.version.toUpperCase();
          } catch (ex) {
            //if (debug) console.log(ex.message);
          }
          all.score = 1;
          all.img = "";
          all.url = "";
          all.hash = 0;
          all.containsSearchAsYouType = hasSearchAsYoutype;
          if (all.facets > 3) {
            all.score = 10;
          } else {
            if (all.results > 3) {
              all.score = 5;
            } else {
              if (all.coveo > 3) {
                all.score = 2;
              }
            }
          }
          return all;
        });

        if (debug)
          console.log("Number of Coveo occurences: " + JSON.stringify(data));
        if (data.score > 0) {
          data.img = file;
          data.url = url;
          await page.screenshot({ path: "results/" + data.img + ".png" }); //, () => {
          if (debug) {
            console.log(
              "Created shot: " +
                "results/" +
                data.img +
                ".png => Score: " +
                data.score
            );
          }
          //Calculate hash to compare the same images
          await this.myimageHash("results/" + data.img + ".png").then(function(
            mydata
          ) {
            data.hash = mydata;
          });
          return data;
          //});
        } else {
          let all = {};
          all.score = 0;
          return all;
        }
      } else {
        let all = {};
        all.score = 0;
        return all;
      }
    } catch (e) {
      //console.log(e);
      let all = {};
      all.score = 0;
      return all;
    } finally {
      await page.close();
    }
    //});
    //return promise;
  }

  async getAnalyticsMetricsDetails(report) {
    var now = new Date();
    var from = new Date();
    var dateusage = new Date();
    dateusage.setMonth(dateusage.getMonth() - 1);
    var dateformetrics =
      dateusage.getFullYear() + "-" + (dateusage.getMonth() + 1);
    from = from.setDate(now.getDate() - nrofdaysAnalytics * 4);
    var fromlast = new Date(from);
    var to = new Date();
    let tasks = [];
    let froms = "&from=" + fromlast.toISOString() + "&to=" + to.toISOString();
    let url1 =
      this.baseUrl +
      "/rest/organizations/" +
      report.org +
      "/searchusagemetrics/raw/monthly?month=" +
      dateformetrics +
      "&minimumQueries=10";
    await this.executeCall(
      url1,
      report,
      "Getting Analtyics Metrics Info",
      "thereAreErrorsSearch",
      "GET",
      this.apiKey
    ).then(function(data) {
      if (debug) {
        console.log(url1);
        console.log("EmptyHubs" + " :" + report.org);
        console.log(data);
      }
      if (data) {
        let totalQ = 0;
        let emptyQ = 0;
        data.searchHubs.map(hub => {
          if (hub.searchHub == "") {
            emptyQ = hub.normalQueries;
            totalQ += hub.normalQueries;
          } else {
            totalQ += hub.normalQueries;
          }
        });
        report.details += "<hr>Usage Metrics info:<br>";
        //EmptyHubs if emptyQ is 10% or higher
        if ((emptyQ / totalQ) * 100 > 10) {
          report.EmptyHubs = true;
          //If so, we also set the det_analyticsSent to false
          report.det_analyticsSent = false;
        } else {
          report.EmptyHubs = false;
        }
        report.details += "Empty Search Hub Queries: " + emptyQ + "<br>";
        report.details += "Total Search Hub Queries: " + totalQ + "<br>";
        report.details +=
          "% Empty Search Hub Queries: " +
          ((emptyQ / totalQ) * 100).toFixed(0) +
          "%<br><br>";
      }
    });
    report.isLive = false;
    let checkLive = false;
    let isLive = true;
    let url2ab =
      this.baseUrl +
      "/rest/ua/v15/stats/combinedData?m=PerformSearch&d=week&f=&fm=&p=1&n=40&s=PerformSearch&asc=false&includeMetadata=true&bindOnLastSearch=true&org=" +
      report.org +
      froms;
    await this.executeCall(
      url2ab,
      report,
      "Getting Analtyics Metrics Info",
      "thereAreErrorsSearch",
      "GET",
      this.apiKey
    ).then(function(data) {
      if (debug) {
        console.log("Live Orgs" + " :" + report.org);
        console.log(data);
      }
      if (data) {
        data["combinations"].map(sourcedet => {
          checkLive = true;
          if (sourcedet.PerformSearch < 1000) {
            isLive = false;
          }
        });
      }
    });
    if (checkLive) {
      report.isLive = isLive;
    }
    let url2a =
      this.baseUrl +
      "/rest/ua/v15/stats/combinedData?m=PerformSearch&d=queryPipeline&f=&fm=&p=1&n=90&s=PerformSearch&asc=false&includeMetadata=true&bindOnLastSearch=true&org=" +
      report.org +
      froms;
    await this.executeCall(
      url2a,
      report,
      "Getting Analtyics Metrics Info",
      "thereAreErrorsSearch",
      "GET",
      this.apiKey
    ).then(function(data) {
      if (debug) {
        console.log("UsedPipelines" + " :" + report.org);
        console.log(data);
      }
      if (data) {
        data["combinations"].map(sourcedet => {
          if (sourcedet.queryPipeline != "") {
            report.usedPipelines.push(sourcedet.queryPipeline);
          }
        });
      }
    });
    let url2 =
      this.baseUrl +
      "/rest/ua/v15/stats/visitsMetrics?m=UniqueVisit&f=%28customeventtype%3D%3D%27Search%27%29+AND+%28searchcausev2%3D~%27searchboxAsYouType%27+OR+searchcausev2%3D~%27searchAsYouType%27%29&org=" +
      report.org +
      froms;
    await this.executeCall(
      url2,
      report,
      "Getting Analtyics Metrics Info",
      "thereAreErrorsSearch",
      "GET",
      this.apiKey
    ).then(function(data) {
      if (debug) {
        console.log("SearchAsyoutype" + " :" + report.org);
        console.log(data);
      }
      if (data) {
        report.SearchAsYouType = data.globalDatas.UniqueVisit.value;
      }
    });
    report.ControlSearch = 0;
    report.ControlFacet = 0;
    report.ControlInterface = 0;
    report.ControlSort = 0;
    report.ControlQuerySuggest = 0;
    report.ControlFieldQS = 0;
    report.ControlOpening = 0;
    report.ControlRecommend = 0;
    report.searchUrls = [];
    report.thesearchurl = [];

    let srcurl =
      inspect.baseUrlAnalytics +
      "/rest/ua/v15/stats/combinedData?m=DocumentView&d=originLevel3&f=%28searchcausev2%3D%3D%27searchboxSubmit%27%29&fm=&p=1&n=6&s=DocumentView&asc=false&includeMetadata=true&bindOnLastSearch=true&org=" +
      report.org +
      froms;
    await this.executeCall(
      srcurl,
      report,
      "Getting Analytics Usage Info",
      "thereAreErrorsSearch",
      "GET",
      inspect.apiKey
    ).then(function(datar) {
      if (datar) {
        datar["combinations"].map(sourcedet => {
          if (sourcedet.originLevel3 != null) {
            if (!sourcedet.originLevel3.includes(".google.")) {
              report.searchUrls.push(sourcedet.originLevel3);
            }
          }
        });
      }
    });

    //Create Screenshots
    let filenr = 0;
    let previous = "";
    let shots = report.searchUrls.map(async searchurl => {
      filenr++;
      let data = await inspect.createScreenshot(
        searchurl,
        report.org + "_" + filenr
      ); //.then(function (data) {
      if (data.score > 0) {
        if (debug) {
          console.log("Created screenshot: " + data.url);
        }
        report.thesearchurl.push({
          score: data.score,
          searchurl: data.url,
          hash: data.hash,
          img: data.img
        });
        if (data.containsSearchAsYouType) {
          report.SearchAsYouType = true;
        }
        if (data.uiVersion != "") {
          report.uiVersion = data.uiVersion;
        }
        if (data.EndpointVersion != "") {
          report.EndpointVersion = data.EndpointVersion;
        }
      }
      //});
    });
    if (debug) {
      console.log("Begin Take Shots");
    }
    await Promise.all(shots).then(() => {
      if (debug) {
        console.log("Shots taken");
      }
      //Sort the array
      report.thesearchurl.sort((a, b) => (a.score > b.score ? -1 : 1));
      //console.log(JSON.stringify(report.thesearchurl));
    });

    let deturl =
      inspect.baseUrlAnalytics +
      "/rest/ua/v15/stats/combinedData?n=2000&m=UniqueVisit&d=searchCauseV2&fm=&p=1&s=UniqueVisit&asc=false&includeMetadata=true&bindOnLastSearch=false&org=" +
      report.org +
      froms;
    await this.executeCall(
      deturl,
      report,
      "Getting Analytics Usage Info",
      "thereAreErrorsSearch",
      "GET",
      inspect.apiKey
    ).then(function(datar) {
      if (datar) {
        datar["combinations"].map(sourcedet => {
          if (
            sourcedet.searchCauseV2 == "facetSelect" ||
            sourcedet.searchCauseV2 == "facetDeSelect" ||
            sourcedet.searchCauseV2 == "facetExclude"
          ) {
            report.ControlFacet += sourcedet.UniqueVisit;
          }
          if (sourcedet.searchCauseV2 == "interfaceChange") {
            report.ControlInterface += sourcedet.UniqueVisit;
          }
          if (sourcedet.searchCauseV2 == "resultsSort") {
            report.ControlSort += sourcedet.UniqueVisit;
          }
          if (
            sourcedet.searchCauseV2 == "omniboxAnalytics" ||
            sourcedet.searchCauseV2 == "omniboxFromLink"
          ) {
            report.ControlQuerySuggest += sourcedet.UniqueVisit;
          }
          if (
            sourcedet.searchCauseV2 == "searchboxSubmit" ||
            sourcedet.searchCauseV2 == "searchFromLink"
          ) {
            report.ControlSearch += sourcedet.UniqueVisit;
          }
          if (sourcedet.searchCauseV2 == "omniboxField") {
            report.ControlFieldQS += sourcedet.UniqueVisit;
          }
        });
      }
    });
    let deturlc =
      inspect.baseUrlAnalytics +
      "/rest/ua/v15/stats/combinedData?n=2000&m=UniqueVisit&d=clickCauseV2&fm=&p=1&s=UniqueVisit&asc=false&includeMetadata=true&bindOnLastSearch=false&org=" +
      report.org +
      froms;
    await this.executeCall(
      deturlc,
      report,
      "Getting Analytics Usage Info",
      "thereAreErrorsSearch",
      "GET",
      inspect.apiKey
    ).then(function(datar) {
      if (datar) {
        datar["combinations"].map(sourcedet => {
          if (
            sourcedet.clickCauseV2 == "documentOpen" ||
            sourcedet.clickCauseV2 == "documentQuickview"
          ) {
            report.ControlOpening += sourcedet.UniqueVisit;
          }
          if (sourcedet.clickCauseV2 == "recommendationOpen") {
            report.ControlRecommend += sourcedet.UniqueVisit;
          }
        });
      }
    });
    if (report.ControlSearch == 0 ){
      report.ControlSearch = 1;
    }
    if (report.ControlSearch > 0) {
      report.ControlFacet = (
        (report.ControlFacet / report.ControlSearch) *
        100
      ).toFixed(0);
      if (Number(report.ControlFacet) > 100) {
        report.ControlFacet = 100;
      }
      report.ControlInterface = (
        (report.ControlInterface / report.ControlSearch) *
        100
      ).toFixed(0);
      if (Number(report.ControlInterface) > 100) {
        report.ControlInterface = 100;
      }
      report.ControlSort = (
        (report.ControlSort / report.ControlSearch) *
        100
      ).toFixed(0);
      if (Number(report.ControlSort) > 100) {
        report.ControlSort = 100;
      }
      report.ControlQuerySuggest = (
        (report.ControlQuerySuggest / report.ControlSearch) *
        100
      ).toFixed(0);
      if (Number(report.ControlQuerySuggest) > 100) {
        report.ControlQuerySuggest = 100;
      }
      report.ControlFieldQS = (
        (report.ControlFieldQS / report.ControlSearch) *
        100
      ).toFixed(0);
      if (Number(report.ControlFieldQS) > 100) {
        report.ControlFieldQS = 100;
      }
    }
    return report;
  }

  async getOrganizations(page) {
    return new Promise((resolve, reject) => {
      request.get(
        `${this.baseUrl}/rest/organizations?page=` + page,
        this.getOptions(),
        (error, response, body) => {
          if ((response && response.statusCode) !== 200) {
            reject();
            return;
          }
          resolve(JSON.parse(body));
        }
      );
    });
  }

  loginSFDC(user, pass) {
    SFDCConnection = new sf.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: "https://na61.salesforce.com"
      //loginUrl: "https://cs18.salesforce.com"
    });
    return SFDCConnection.login(user, pass);
  }

  logoutSFDC() {
    SFDCConnection.logout(function(err) {
      if (err) {
        return console.error(err);
      }
      // now the session has been expired.
    });
  }

  async deleteAttachment (data) {
    var cp_id = "";
    console.log('Start checking delete');
    try
    {
    await SFDCConnection.query(
      `SELECT ContentDocumentId FROM ContentVersion where Title ='${data.org}'`,
      function(err, result) {
        if (err) {
          console.error(err);
          cp_id = "";
        }
        if (result.records.length >= 1) {
          //console.log(result);
          console.log("Attachment exists, id=" + result.records[0]["ContentDocumentId"]);
          cp_id = result.records[0]["ContentDocumentId"];
          
        } else {
          console.log(
            "No Attachment yet"
          );
          cp_id = "";
        }
      }
    );
    if (cp_id!=""){
     
      await SFDCConnection.sobject('ContentDocument').del([cp_id] ,
        function(err, rets) {
          if (err) { return console.error(err); }
          for (var i=0; i < rets.length; i++) {
            if (rets[i].success) {
              console.log("Deleted Successfully : " + rets[i].id);
            }
          }
        });
       /* await SFDCConnection.sobject('ContentDocumentLink').del([cp_id] ,
          function(err, rets) {
            if (err) { return console.error(err); }
            for (var i=0; i < rets.length; i++) {
              if (rets[i].success) {
                console.log("Deleted Successfully : " + rets[i].id);
              }
            }
          });*/
    }
  }
  catch(ex2){
    if (debug) {
      console.log(ex2.message);
    }
  }
    console.log('Done checking delete');
    return cp_id;
  }
  
  async createAttachment(data) {
    let id='';
    var date = new Date();
    //Delete previous
    await inspect.deleteAttachment(data);
    //Create new content version
    try
    {
    await SFDCConnection.sobject("ContentVersion").create(
      [
        {
          //This is the 
          FirstPublishLocationId : data.cp_id,
          Title : data.org +' '+date.toISOString().split("T")[0],
          PathOnClient : '/'+data.file,
          VersionData : inspect.getImage64(data.file)
        }
      ],
      function(err, rets) {
        if (err) {
          return console.error(err);
        }
        for (var i = 0; i < rets.length; i++) {
          if (rets[i].success) {
            console.log(rets[i]);
            console.log("Created attachment id : " + rets[i].id);
            id=rets[i].id;
          }
        }
      }
      );
      //Get ContentDocumentId of previous created record
      /*let doc_id = '';
      await SFDCConnection.query(
        `SELECT ContentDocumentId FROM ContentVersion where Title ='${data.org}'`,
        function(err, result) {
          if (err) {
            console.error(err);
            doc_id = "";
          }
          if (result.records.length >= 1) {
            
            doc_id = result.records[0]["ContentDocumentId"];
            
          } else {
            
            doc_id = "";
          }
        }
      );
      console.log("Content Doc: "+data.cp_id+"/"+doc_id);
      //Add ContentDocumentLink for sharing settings
      await SFDCConnection.sobject("ContentDocumentLink").create(
        [
          {
            //This is the 
            ContentDocumentId : doc_id,
            LinkedEntityId : data.cp_id,
            ShareType : 'C',
            Visibility : 'SharedUsers'
          }
        ],
        function(err, rets) {
          if (err) {
            return console.error(err);
          }
          for (var i = 0; i < rets.length; i++) {
            if (rets[i].success) {
              console.log(rets[i]);
              console.log("Created ContentDocumentLink id : " + rets[i].id);
              //id=rets[i].id;
            }
          }
        }
        );*/
      }
      catch(ex2){
        if (debug) console.log(ex2.message);
      }
      return id;
    };

  async checkCloudOrg(orgId) {
    var data = {};
    data.orgId = "";
    data.accId = "";
    data.oppId = "";
    //data.prodId = "";
    console.log("Getting Cloud Org Object");
    await SFDCConnection.query(
      `SELECT ID, Cloud_Organization_ID__c, Account__r.Id, Opportunity__r.Id  FROM Coveo_Cloud_License__c where Cloud_Organization_ID__c ='${orgId}'`,
      function(err, result) {
        if (err) {
          console.error(err);
          data.orgId = "";
        }
        if (result.records.length == 1) {
          //console.log(result);
          console.log("Cloud Org Record exists, id=" + result.records[0]["Id"]);
          data.orgId = result.records[0]["Id"];
          data.accId = "";
          data.oppId = "";
          if (result.records[0]["Account__r"] != null) {
            console.log(
              "Cloud Org Record exists, accid=" +
                result.records[0]["Account__r"]["Id"]
            );
            data.accId = result.records[0]["Account__r"]["Id"];
          }
          if (result.records[0]["Opportunity__r"] != null) {
            console.log(
              "Cloud Org Record exists, oppid=" +
                result.records[0]["Opportunity__r"]["Id"]
            );
            data.oppId = result.records[0]["Opportunity__r"]["Id"];
          }
        } else {
          console.log("Cloud Org DOES NOT EXISTS");
        }
      }
    );
    return data;
  }

  async checkCustomerProject(orgId) {
    var cp_id = "";
    await SFDCConnection.query(
      `SELECT ID, Coveo_Cloud_Organization_ID__c FROM Project_Non_Billable__c where Coveo_Cloud_Organization_ID__c ='${orgId}'`,
      function(err, result) {
        if (err) {
          console.error(err);
          cp_id = "";
        }
        if (result.records.length >= 1) {
          console.log(result);
          result.records.forEach(rec => {
            console.log("Customer Project exists, id=" + rec["Id"]);
            cp_id = cp_id + ";" + rec["Id"];
          });
        } else {
          console.log(
            "Customer project does not exists, looking for Cloud Org object..."
          );
          cp_id = "";
        }
      }
    );
    return cp_id;
  }

  async createCustomerProject(data) {
    var date = new Date();
    let id='';
    const SFDCRecType = "0120d0000001GrS";
    const SitecoreRecType = "0120d0000001GrT";
    const DynamicsRecType = "0120d0000005Ptp";
    const PlatformRecType = "0120d0000009ghC";
    var recType = PlatformRecType;
    if (data.productEdition.includes("SITECORE")) {
      recType = SitecoreRecType;
    }
    if (data.productEdition.includes("SALESFORCE")) {
      recType = SFDCRecType;
    }
    if (data.productEdition.includes("DYNAMICS")) {
      recType = DynamicsRecType;
    }
    try
    {
    await SFDCConnection.sobject("Project_Non_Billable__c").create(
      [
        {
          Name: data.name,
          //  Coveo_Cloud_Organization_ID__c: 'akqademotaeqdoul',
          Status__c: data.isLive ? "Closed" : "Opened",
          Coveo_Cloud_Organization__c: data.orgId,
          Parent_Account__c: data.accId,
          Opportunity__c: data.oppId,
          Intervention_Required__c: !(data.status == "OK"),
          Deployed_Regions__c:
            typeof data.regions === "undefined" ? "" : data.regions.join("\n"),
          Org_Checker_Date__c: date.toISOString().split("T")[0],
          Index_Size__c: data.docsfromsourcesClean,
          Accessible_Search_URL__c: data.SFDCSearchUrl,
          Available_Memory__c: data.infra_mem_free,
          Available_Disk_Space__c: data.infra_disk_free,
          Bad_Web_Sources__c: data.sourceWebWarning,
          Total_Number_of_Sources__c: data.nrofsources,
          Sources_without_Schedules__c: data.nrofnoschedulessources != 0,
          Used_Connectors__c: data.types.join("\n"),
          Using_Push_API__c: data.containspush,
          Using_Crawling_Module__c: data.containsonprem,
          Security_Providers_Without_Schedules__c:
            data.noscheduledsecprov.length != 0,
          Total_Extensions_with_Errors__c: data.nrerrorextensions,
          Total_Disabled_Extensions__c: data.nrofdisabledextensions,
          Total_Slow_Extensions__c: data.nrslowextensions,
          Total_Extensions_that_Timeout__c: data.nrtimeoutextensions,
          Total_Query_Pipelines__c: data.nrofpipelines,
          Used_Query_Pipelines__c: data.usedPipelines.join("\n"),
          ML_Version__c: data.models_platformVersion,
          ML_QS_Enabled__c: data.mlquerysuggest,
          ML_ART_Enabled__c: data.mlart,
          ML_Recommendations_Enabled__c: data.mlrecommendation,
          ML_DNE_Enabled__c: data.mldne,
          Number_of_Thesaurus_Entries__c: data.nrofthesaurus,
          Number_of_Ranking_Expressions__c: data.nrofqre,
          Number_of_Featured_Results__c: data.nroffeatured,
          Analytics_Triggered__c: data.det_analyticsSent,
          Empty_Hubs__c: data.EmptyHubs,
          Using_Search_as_You_Type__c: data.UsingSearchAsYouType,
          Average_Response_Time__c: data.AvgResponse,
          Unique_Visits__c: data.UniqueVisit,
          Total_Searches__c: data.PerformSearch,
          Total_Searches_with_Clicks__c: data.SearchWithClick,
          Click_Through__c: data.ClickThroughRatio,
          Click_Rank__c: data.AverageClickRank,
          Percentage_Using_Facets__c: data.ControlFacet,
          Percentage_Using_Different_Interfaces__c: data.ControlInterface,
          Percentage_Using_Query_Suggest__c: data.ControlQuerySuggest,
          Percentage_Using_Field_Query_Suggest__c: data.ControlFieldQS,
          Percentage_Using_Sorting__c: data.ControlSort,
          HTML_Report_Location__c: data.reportLoc,
          Required_Fixes__c: data.statusDetails
            .replace(/<i>/g, "")
            .replace(/<\/i>/g, ""),
          JSUI_Version__c: data.uiVersion,
          RecordTypeId: recType
          //https://na61.salesforce.com/setup/ui/recordtypefields.jsp?id=&type=&setupid=CustomObjects&
        }
      ],
      function(err, rets) {
        if (err) {
          return console.error(err);
        }
        for (var i = 0; i < rets.length; i++) {
          if (rets[i].success) {
            console.log("Created record id : " + rets[i].id);
            id =  rets[i].id;
            
          }
        }
        // ...
      }
    );
    }
    catch(ex2){
      if (debug) console.log(ex2.message);
    }
    return id;
  }

  async updateCustomerProject(data) {
    var date = new Date();
    try
    {
    await SFDCConnection.sobject("Project_Non_Billable__c").update(
      [
        {
          Id: data.cp_id,
          //Status__c: data.isLive ? "Closed" : "Opened",
          Intervention_Required__c: !(data.status == "OK"),
          Deployed_Regions__c:
            typeof data.regions === "undefined" ? "" : data.regions.join("\n"),
          Org_Checker_Date__c: date.toISOString().split("T")[0],
          Index_Size__c: data.docsfromsourcesClean,
          Accessible_Search_URL__c: data.SFDCSearchUrl,
          Available_Memory__c: data.infra_mem_free,
          Available_Disk_Space__c: data.infra_disk_free,
          Bad_Web_Sources__c: data.sourceWebWarning,
          Total_Number_of_Sources__c: data.nrofsources,
          Sources_without_Schedules__c: data.nrofnoschedulessources != 0,
          Used_Connectors__c: data.types.join("\n"),
          Using_Push_API__c: data.containspush,
          Using_Crawling_Module__c: data.containsonprem,
          Security_Providers_Without_Schedules__c:
            data.noscheduledsecprov.length != 0,
          Total_Extensions_with_Errors__c: data.nrerrorextensions,
          Total_Disabled_Extensions__c: data.nrofdisabledextensions,
          Total_Slow_Extensions__c: data.nrslowextensions,
          Total_Extensions_that_Timeout__c: data.nrtimeoutextensions,
          Total_Query_Pipelines__c: data.nrofpipelines,
          Used_Query_Pipelines__c: data.usedPipelines.join("\n"),
          ML_Version__c: data.models_platformVersion,
          ML_QS_Enabled__c: data.mlquerysuggest,
          ML_ART_Enabled__c: data.mlart,
          ML_Recommendations_Enabled__c: data.mlrecommendation,
          ML_DNE_Enabled__c: data.mldne,
          Number_of_Thesaurus_Entries__c: data.nrofthesaurus,
          Number_of_Ranking_Expressions__c: data.nrofqre,
          Number_of_Featured_Results__c: data.nroffeatured,
          Analytics_Triggered__c: data.det_analyticsSent,
          Empty_Hubs__c: data.EmptyHubs,
          Using_Search_as_You_Type__c: data.UsingSearchAsYouType,
          Average_Response_Time__c: data.AvgResponse,
          Unique_Visits__c: data.UniqueVisit,
          Total_Searches__c: data.PerformSearch,
          Total_Searches_with_Clicks__c: data.SearchWithClick,
          Click_Through__c: data.ClickThroughRatio,
          Click_Rank__c: data.AverageClickRank,
          Percentage_Using_Facets__c: data.ControlFacet,
          Percentage_Using_Different_Interfaces__c: data.ControlInterface,
          Percentage_Using_Query_Suggest__c: data.ControlQuerySuggest,
          Percentage_Using_Field_Query_Suggest__c: data.ControlFieldQS,
          Percentage_Using_Sorting__c: data.ControlSort,
          HTML_Report_Location__c: data.reportLoc,
          Required_Fixes__c: data.statusDetails
            .replace(/<i>/g, "")
            .replace(/<\/i>/g, ""),
          JSUI_Version__c: data.uiVersion

          //https://na61.salesforce.com/setup/ui/recordtypefields.jsp?id=&type=&setupid=CustomObjects&
        }
      ],
      function(err, rets) {
        if (err) {
          return console.error(err);
        }
        for (var i = 0; i < rets.length; i++) {
          if (rets[i].success) {
            console.log("Updated record id : " + rets[i].id);
          }
        }
        // ...
      }
    );
    }
    catch(ex2){
      if (debug) console.log(ex2.message);
    }
  }

 
  sleep(ms){
     return new Promise(resolve=>{
         setTimeout(resolve,ms)
     })
 }

  async inspectOrganization(id) {
    var options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    };
    var today = new Date();
    var checkHTML = new RegExp(/<[a-z][\s\S]*>/gi);
    let json = {
      forOrgReport: true,
      location: id.id,
      org: id.id,
      theDate: today.toLocaleDateString("en-US", options),
      allfields: [],
      querycheck: false,
      badquery: "",
      nrofrequests: 0,
      cq: [],
      MLModels: [],
      MLModelsInfo: [],
      filterfields: [],
      singlewordfields: [],
      singlewordfieldscontains: [],
      singlewordfieldsmatch: [],
      qpl_with_filters: [],
      nrofqpl_with_filters: 0,
      allmetadatavalues: false,
      nrofextensions: 0,
      nrofdisabledextensions: 0,
      nrofpipelines: 0,
      SearchAsYouType: 0,
      nrerrorextensions: 0,
      nrslowextensions: 0,
      nrtimeoutextensions: 0,
      sourceids: [],
      badfields_facettolong: [],
      name: id.displayName,
      orgtype: "",
      disabledextensions: [],
      errorextensions: [],
      slowextensions: [],
      nroffields: 0,
      nrofsystemfields: 0,
      nrofcustomfields: 0,
      nroffieldsnotused: 0,
      nroffacets: 0,
      nrofsorts: 0,
      errors: "",
      thereAreErrorsOrg: false,
      thereAreErrorsSources: false,
      thereAreErrorsFields: false,
      thereAreErrorsExtensions: false,
      thereAreErrorsSearch: false,
      nroffreetext: 0,
      nroffieldscachesort: 0,
      nroffieldscachecomputed: 0,
      nroffieldscachenested: 0,
      nroffieldscachenumeric: 0,
      timeoutextensions: [],
      badfields_contains_allmeta: [],
      badfields_contains_body: [],
      badfields_contains_html: [],
      badfields_wrong_config: [],
      badfields_filtered: [],
      badfields_query: [],
      types: [],
      containspush: false,
      containsonprem: false,
      push_without_html: [],
      normal_without_html: [],
      badfields_contains_duplicate_info: [],
      end_content_always_the_same: [],
      logerrors: 0,
      push_without_batch: [],
      logwarnings: 0,
      details: "",
      usagedetails: "",
      details_facettolong: "",
      details_alwaysthesame: "",
      details_pipelines: "",
      details_ml: "",
      infra_machine: "No Access",
      infra_storage: "No Access",
      infra_storage_size: "No Access",
      infra_indexes: 0,
      infra_slices: 0,
      infra_mem_free: 0,
      infra_disk_free: 0,
      securityerrors: 0,
      mlquerysuggest: true,
      usedPipelines: [],
      mlart: true,
      mlrecommendation: true,
      models_platformVersion: 1,
      version: "V2",
      mldne: false,
      nrofthesaurus: 0,
      nrofqre: 0,
      nroffeatured: 0,
      docsfromsources: 0,
      docsfromsourcesClean: 0,
      nrofsources: 0,
      logwarnings: 0,
      logerrors: 0,
      notfresh: [],
      numberofsecurities: 0,
      uiVersion: "",
      pipelines: [],
      dimensions: [],
      topQueries: [],
      badClick: [],
      badRank: [],
      badUsage: [],
      UniqueVisit: 0,
      PerformSearch: 0,
      SearchWithClick: 0,
      ClickThroughRatio: 0,
      AverageClickRank: 0,
      RefinementQuery: 0,
      DocumentView: 0,
      sourceWebWarning: false,
      AvgResponse: 0,
      NrofCaseCreationPageVisits: 0,
      NrofCaseAbandons: 0,
      NrofCaseCreations: 0,
      NrofCaseDeflections: 0,
      EmptyHubs: false,
      noscheduledsecprov: [],
      nrofnoscheduledsecprov: 0,
      det_analyticsSent: false,
      productEdition: "",
      productType: "",
      EndpointVersion: "",
      accountName: "",
      accountId: "",
      infra_machine: "",
      regions: [],
      thesearchurl: []
    };
    //console.log("GetSourceInfo");
    //We need to check if it was already done, else skip it
    var filecheck= "./results/" + json.org + ".html";
    if (fs.existsSync(filecheck)) {
      console.log("Org "+json.org+" already done... skipping");
      return;
    } else 
    {
      //Always write at least a file so we do not parse the org again
      fs.writeFileSync("./results/" + json.org + ".html", "Empty");

    }
    json = await inspect.getSourceInfo(json);

    if (json.nrofsources == 0) {
      if (debug) {
        console.log(
          "Org: " + json.org + " does not contains sources or no access."
        );
        console.log(
          "=============================================================="
        );
      } else {
        console.log(json.org + " NO SOURCES FOUND ");
        console.log(json.org + "," + json.name + ",,,,,,");
      }
    } else {
      //Get source Schedules
      if (debug) console.log("GetSourceSchedules");
      let sourcenoschedule = [];

      for (const source of json.sourceids) {
        //If a push source is used no need to check for a schedule.
        let isPush =
          json.pushnames.filter(source2 => {
            if (source2.name == source.name) return source2.name;
          }).length > 0;
        if (!isPush) {
          const data = await inspect.getSourceSchedules(json, source.id);
          if (!data) {
            sourcenoschedule.push(source.id);
          }
        }
      }

      json.noscheduledsources = sourcenoschedule;
      json.nrofnoschedulessources = sourcenoschedule.length;

      if (debug) console.log("getSecurityInfo");
      //Get Security Providers info
      json = await inspect.getSecurityInfo(json);
      json.nrofnoscheduledsecprov = json.noscheduledsecprov.length;

      // We do not have access to extensions
      //console.log("getExtensionInfo");
      //Get Extensions Info
      //json = await inspect.getExtensionInfo(json);

      if (debug) console.log("getModelsInfo");
      //Get Models Info
      json = await inspect.getModelsInfo(json);

      if (debug) console.log("getLicense");
      json = await inspect.getLicense(json);

      //IF we have the wrong productType, abort
      if (json.productType != "STANDARD") {
        console.log("ABORT ORG IS NO STANDARD PRODUCTTYPE");
        return;
      }

      if (debug) console.log("getNodeInfo");
      //Get Node Info
      json = await inspect.getNodeInfo(json);

      if (debug) console.log("getAnalyticsMetricsInfo");
      //Get Analytics Metrics Info
      json = await inspect.getAnalyticsMetricsInfo(json);

      if (debug) console.log("getAnalyticsMetricsDetails");
      json = await inspect.getAnalyticsMetricsDetails(json);

      if (debug) console.log("getMLModels");
      json = await inspect.getMLModels(json);

      let pipesToCheck = [];
      if (debug) console.log("getQueryPipelinesInfo");
      json = await inspect.getQueryPipelinesInfo(json);

      //If usedPipelines is empty, then use all Query pipelines
      if (json.usedPipelines.length == 0) {
        json.pipelines.map(pipes => {
          pipesToCheck.push(pipes.name);
        });
      } else {
        json.usedPipelines.map(pipes => {
          pipesToCheck.push(pipes);
        });
      }

      for (const pipes of json.pipelines) {
        //Only if inside pipesToCheck
        if (pipesToCheck.includes(pipes.name)) {
          await inspect.getQueryPipelinesDetails(json, pipes);
        }
      }
      json.nrofqpl_with_filters = json.qpl_with_filters.length;

      if (debug) console.log("got QPLS");

      let data = json;
      if (debug) {
        console.log(data.org);
        console.log("Org: " + data.org + " (" + data.name + ")");
        console.log("   Analytics Tracked: " + data.det_analyticsSent);
        console.log("   Missing QS: " + !data.mlquerysuggest);
        console.log("   Missing ART: " + !data.mlart);
        console.log("   Missing SearchHubs: " + data.EmptyHubs);
        console.log(
          "   Search As You Type enabled: " + (data.SearchAsYouType != 0)
        );
        console.log(
          "=============================================================="
        );
      }

      console.log(
        data.org +
          "," +
          data.name +
          "," +
          data.det_analyticsSent +
          "," +
          !data.mlquerysuggest +
          "," +
          !data.mlart +
          "," +
          (data.EmptyHubs != 0) +
          "," +
          (data.SearchAsYouType != 0)
      );
      let report =
        "<p>   Analytics Tracked: " + data.det_analyticsSent + "<br>";
      report += "   Missing QS: " + !data.mlquerysuggest + "<br>";
      report += "   Missing ART: " + !data.mlart + "<br>";
      report += "   Missing SearchHubs: " + data.EmptyHubs + "<br>";
      report +=
        "   Search As You Type enabled: " +
        (data.SearchAsYouType != 0) +
        "<br>";
      report += "<hr>";
      report += data.usagedetails;

      //Provide a Status based upon analysis
      data.status = "";
      data.statusDetails = "";

      let mysearchurls = "";
      data.accessibleUrls = [];
      data.SFDCSearchUrl = "";
      let newsearchurls = [];
      let screenshots = [];
      var firstHash = 0;
      for (const urls of data.thesearchurl) {
        //They are sorted on score, so the best first
        //We need to remove duplicate images
        let addIt = true;
        if (firstHash == 0) {
          firstHash = urls.hash;
          screenshots.push(urls.img);
          //Create mobile screenshot
          let mdata = await inspect.createScreenshotMobile(
            urls.searchurl,
            data.org + "_mobile"
          );
          if (mdata.img != undefined) {
            newsearchurls.push({
              score: mdata.score,
              searchurl: mdata.url,
              hash: mdata.hash,
              img: mdata.img
            });
            screenshots.push(mdata.img);
          }
          //newsearchurls.push(data);
        } else {
          //Compare it with previous
          if (debug) {
            console.log("First hash: " + firstHash);
            console.log("Current: " + urls.hash);
          }
          if (this.hammingDistance(firstHash, urls.hash) < 60) {
            //Remove it
            addIt = false;
          } else {
            firstHash = urls.hash;
          }
        }
        if (addIt) {
          mysearchurls += urls.searchurl + "\n";
          data.accessibleUrls.push(
            '<a target="_blank" href="' +
              urls.searchurl +
              '">' +
              urls.searchurl +
              "</a>"
          );
          newsearchurls.push(urls);
          if (data.SFDCSearchUrl == "") {
            data.SFDCSearchUrl = urls.searchurl;
          }
        }
      }
      data.thesearchurl = newsearchurls;
      data.UsingSearchAsYouType = data.SearchAsYouType != 0;
      data.qpl_with_filters = [...new Set(data.qpl_with_filters)];

      let html = this.processReport(data);

      let mydata = {
        OrgId: data.org,
        OrgName: data.name,
        OrgLink:
          '=HYPERLINK("' + this.baseUrl + "/admin/#" + data.org + '";"LINK")',
        OrgLoc: this.baseUrl.split(".")[0].replace("https://", ""),
        productType: data.productType,
        ResponseMs: data.AvgResponse,
        UsingSearchAsYouType: data.UsingSearchAsYouType,
        NoOfSources: data.nrofsources,
        IndexSize: data.docsfromsources,
        freeDisk: data.infra_disk_free,
        freeMem: data.infra_mem_free,
        SourceNoSchedules: data.nrofnoschedulessources,
        ConnectorsUsed: data.types.join("\n"),
        BadWeb: data.sourceWebWarning,
        JSUI: data.uiVersion,
        UsingPush: data.containspush,
        Status: data.status,
        StatusDetails: data.statusDetails
          .replace(/<br>/g, "\n")
          .replace(/<i>/g, "")
          .replace(/<\/i>/g, ""),
        UsingCrawlingModules: data.containsonprem,
        SecurityProvidersNoSchedules: data.noscheduledsecprov.length,
        NoOfExtensionWithErrors: data.nrerrorextensions,
        NoOfExtensionsDisabled: data.nrofdisabledextensions,
        NoOfExtensionsSlow: data.nrslowextensions,
        NoOfExtensionsWithTimeout: data.nrtimeoutextensions,
        NoOfQueryPipelines: data.nrofpipelines,
        ML_QSEnabled: data.mlquerysuggest,
        ML_ARTEnabled: data.mlart,
        ML_RecommendationsEnabled: data.mlrecommendation,
        ML_DNEEnabled: data.mldne,
        NoOfThesaurusEntries: data.nrofthesaurus,
        NoOfRankingExpressions: data.nrofqre,
        NoOfFeaturedResults: data.nroffeatured,
        AnalyticsTriggered: data.det_analyticsSent,
        EmptyHubs: data.EmptyHubs,
        AverageResponseTime: data.AvgResponse,
        Analytics_LowOrigin_Usage: data.badUsage,
        Analytics_LowClickThrough: data.badRank,
        Analytics_UniqueVisits: data.UniqueVisit,
        Analytics_NoOfSearches: data.PerformSearch,
        Analytics_NoOfSearchesWithClick: data.SearchWithClick,
        Analytics_ClickThrough: data.ClickThroughRatio,
        Analytics_ClickRank: data.AverageClickRank,
        Analytics_Details: "",
        UsingFacets: data.ControlFacet,
        UsingInterfaces: data.ControlInterface,
        UsingQS: data.ControlQuerySuggest,
        UsingFieldQS: data.ControlFieldQS,
        UsingSorting: data.ControlSort,
        UsingPaging: data.ControlPaging,
        /*'UsingOpen': data.ControlOpening,*/
        productEdition: data.productEdition,
        EndpointVersion: data.EndpointVersion,
        accountName: data.accountName,
        accountId:
          '=HYPERLINK("https://na61.salesforce.com/' +
          data.accountId +
          '";"LINK")',
        infra_machine: data.infra_machine,
        regions:
          typeof data.regions === "undefined" ? "" : data.regions.join("\n"),
        searchUrls:
          typeof data.searchUrls === "undefined"
            ? ""
            : data.searchUrls.join("\n"),
        accessibleSearchUrl: mysearchurls
      };
      //console.log(mydata);
      //let html = `<html><body><h1>${data.org}</h1>${report}${JSON.stringify(mydata)}</body></html>`;
      data.file = "./results/" + data.org + ".html";

      fs.writeFileSync("./results/" + data.org + ".html", html);
      
      mydata["SFDCStatus"] = "OK";
      //Copy to s3
      // HTML and Images = screenshots

      let cp_id = await inspect.checkCustomerProject(data.org);
      data.cp_id = '';
      if (cp_id == "") {
        //We have no Customer Project, check if Cloud Org Exists
        const orgData = await inspect.checkCloudOrg(data.org);
        if (orgData.orgId == "") {
          //We have no cloud org
          console.log("NO CLOUD ORG, STOP");
          mydata["SFDCStatus"] = "NO CLOUD ORG";
        } else {
          //Continue adding new customer Project
          console.log("CLOUD ORG, ADD CUSTOMER PROJECT");
          data.orgId = orgData.orgId;
          data.accId = orgData.accId;
          data.oppId = orgData.oppId;
          mydata["SFDCStatus"] = "CREATED CP";
          cp_id = await inspect.createCustomerProject(data);
          data.cp_id = cp_id;
          //Wait for 1 sec
          await inspect.sleep(500);
          //We need a Customer Project first before we can create an attachment
          data.locid = await inspect.createAttachment(data);
          data.reportLoc = this.settings.SFDC_Download.replace("{ID}",data.locid);
          await inspect.updateCustomerProject(data);
        }
      } else {
        let ids = cp_id.split(";");
        data.cp_id = ids[1];
        data.locid = await inspect.createAttachment(data);
        data.reportLoc = this.settings.SFDC_Download.replace("{ID}",data.locid);
        for (const id of ids) {
          if (id != "") {
            data.cp_id = id;

            console.log("UPDATE CUSTOMER PROJECT");
            mydata["SFDCStatus"] = "UPDATED CP";
            await inspect.updateCustomerProject(data);
          }
        }
      }
      if (data.cp_id!=""){
          
      }
      fs.writeFileSync(
        "./results/" + data.org + ".json",
        JSON.stringify(mydata)
      );
      let dataEncoded = qs.stringify(mydata);
      const callApi = require("./callApi");
      let mdata = [];
      const options = {
        url:
          "https://script.google.com/macros/s/AKfycby6s0EcYjhAfhSCrF4k4ilAi_uUVcGdi32dL_FCX-JlqyXQApTF/exec",
        method: "post",
        gzip: true,
        body: [],
        //form: mydata,

        followAllRedirects: true,
        headers: {
          "Content-Length": Buffer.byteLength(dataEncoded),
          "Content-Type": "application/x-www-form-urlencoded"
        }
      };

      //Push it to the google Sheet
      if (addGoogleSheet) {
        const response = await callApi(options, dataEncoded);
      }

      //Push it to Salesforce
      //First check if we have a cloud Org
      // If so, retrieve account id and opp id
      //Second check if we have a customer implementation object
      // If so, update it
      // If not, create it
    }
  }

  async getToken(){
    let _this = this;
    await this.doActualLogin().then(function(data){
      if (debug) console.log(data);
      _this.apiKey = data['access_token'];
         //return data['access_token']
    });

  }
  async doActualLogin() {
    /*let _this = this;
      return new Promise((resolve, reject) => {
        console.log("calling oauth token.")
        request.post(
          `${this.baseUrl}/oauth/token?grant_type=client_credentials`,
          {
            'auth': {
              'user': _this.settings.apiKeyUser,
              'pass': _this.settings.apiKeyPass,
              'sendImmediately': false
            }},
          (error, response, body) => {
            console.log(response);
            if ((response && response.statusCode) !== 200) {
              reject();
              return;
            }
            resolve(JSON.parse(body));
          }
        );
      });*/

    
    let mybrowser = await puppeteer.launch({ headless: false });
    const adminpage = await mybrowser.newPage();

    await adminpage.goto("https://platform.cloud.coveo.com/admin", {
      waitUntil: "networkidle0",
      timeout: 0
    });
    //await page.setViewport({ width: 1280, height: 800 })
    //await page.goto('https://myawesomesystem/loginFrm01')
    const navigationPromise = adminpage.waitForNavigation();

    // Clicks on the login button
    const googleLoginButtonSelector = "#loginWithGoogle";
    await adminpage.waitForSelector(googleLoginButtonSelector);
    await adminpage.click(googleLoginButtonSelector);

    // wait for the google oauth page to open
    const googleOAuthTarget = await mybrowser.waitForTarget(
      target => {
        // console.log( target.url() ); // debugging
        return (
          target
            .url()
            .indexOf("https://accounts.google.com/signin/oauth/identifier") !==
          -1
        );
      },
      { duration: 3 }
    );

    const googleOAuthPage = await googleOAuthTarget.page();

    await googleOAuthPage.waitForSelector("#identifierId");
    await googleOAuthPage.type("#identifierId", this.settings.SFDC_User, {
      delay: 5
    });
    await googleOAuthPage.click("#identifierNext");

    await googleOAuthPage.waitForSelector('input[type="password"]', {
      visible: true
    });
    await googleOAuthPage.type(
      'input[type="password"]',
      this.settings.Normal_Pass
    );

    await googleOAuthPage.waitForSelector("#passwordNext", { visible: true });
    await googleOAuthPage.click("#passwordNext");

    await navigationPromise;
    await adminpage.waitForSelector(".member");
    //var access='';
    const access = await adminpage.evaluate(function() {
      //access = window.admin.currentAccessToken;
      return window.admin.currentAccessToken;
      //console.log(access);
    });
    await mybrowser.close();
    //const [ returnedCookie ] = await adminpage.cookies('https://platform.cloud.coveo.com/admin/');
    //console.log("cookies:");
    //console.log(returnedCookie);
    this.apiKey = access;
  }

  async loginPlatform() {
    let retry = 0;
    console.log("Login platform.")
    while (retry < 3) {
      try {
        //return inspect.getToken();
        return inspect.doActualLogin();
      } catch {
        retry = retry + 1;
      }
    }
  }

  async start() {
    await inspect.loginPlatform();
    //console.log("Apikey: " + this.apiKey);
    //return;
    await inspect
      .loginSFDC(this.settings.SFDC_User, this.settings.SFDC_Pass)
      .then(function(data) {
        //if (err) { console.log("Error:");console.error(err); return err; }
        // logged in user property
        console.log("User ID: " + data.id);
        console.log("Org ID: " + data.organizationId);
      });
    console.log("Return from SFDC:");
    //console.log(SFDCConnection);
    console.log(SFDCConnection.accessToken);
    console.log(SFDCConnection.instanceUrl);

    if (debug) {
      console.log("Getting organizations...");
    } else {
      console.log(
        "OrgId,OrgName,AnalyticsSent,MissingQS,MissingArt,MissingSearchHub,UsingSearchAsYouType,Report"
      );
    }
    //Get first
    let mycounter = 0;
    let debugCount = 4350;
    let pageIndex = 0;
    let orgs = await this.getOrganizations(pageIndex);

    //orgs.items = orgs.items.filter(org => (/aarp/i).test(org.id));
    while (pageIndex < orgs.totalPages) {
      for (let org of orgs.items) {
        //console.log(org);
        //if (toprocess.includes(org.id)) {
        if (!org.readOnly) {
          console.log(mycounter + " == " +org.id);
          await this.inspectOrganization(org);
          //          break;
          //if (debug) {
          mycounter = mycounter + 1;
          //}
          if (mycounter > debugCount) {
            await inspect.loginPlatform();
            mycounter = 0;
          }
        }
        //}
      }
      pageIndex++;
      if (mycounter > debugCount) {
        await inspect.loginPlatform();
        mycounter = 0;
      }
      if (pageIndex < orgs.totalPages) {
        orgs = await this.getOrganizations(pageIndex);
        console.log("Getting next page of orgs");
      }
    }
    browser.close();
    await inspect.logoutSFDC();
    console.log("Ready");

    console.log("Removing output directory");
    try { var files = fs.readdirSync('results'); }
      catch(e) { console.log(e); }
      if (files.length > 0)
        for (var i = 0; i < files.length; i++) {
          var filePath = 'results' + '/' + files[i];
          if (fs.statSync(filePath).isFile())
            fs.unlinkSync(filePath);
        }
    process.exit();
  }
}

console.log("Make sure to clear the results directory with the orgs you DO NOT WANT TO REINDEX!!!!");
let inspect = new InspectAllOrganizations();
inspect.initPuppet();
inspect.start();
