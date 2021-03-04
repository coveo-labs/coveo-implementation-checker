# Chrome Extension

The coveo-implementation-checker extension allows you validate your Coveo implementation.

## Organization

Check your Coveo Organization. Is it properly configured, Sources, Fields, Extensions, Query Pipelines.
The following checks are made:

For every source 2 queries are being executed. One to check for the field contents, one to check for freshness of the data. More queries are being executed to examine the field contents.

-   Type of Infrastructure the Index runs on
-   SSD drives
-   Nr of Indexers (for fail safe)

Sources

-   Types of connectors used
-   Contains Push sources
-   Contains Crawling modules
-   Sources without refresh schedules
-   Sources without new content in the last 60 days
-   Checker executes a query to check for results, based upon modification date
-   Push sources without batch calls
-   The Log browser is checked, if there are Batch calls present in the last week
-   Normal sources/Push sources without HTML content
-   A query is being executed, 500 results are examined if it contains a quickview version
-   Content is the same (ends with the same content)
-   Only on fields which have ‘Free text’ enabled
-   A query is being executed, 500 results are examined
-   Log browser errors/warnings
-   The Log browser is checked, if there are errors/warnings present in the last week
-   Security Identity errors
-   Security Provider Schedules. Are they configured, if so are they enabled
-   Nr of Security Identities

Fields

-   Allmetadatavalues used
-   A query is being executed, 500 results are examined. The content is checked for entries of the output of the allmetadatavalues script
-   Facet values to long
-   A query is being executed, 500 results are examined. If the individual values are exceeding 150 characters a warning is set. If the individual value also contains a delimiter (;), it will be reported in the details section.
    Contains HTML
-   A query is being executed, 500 results are examined. The values are being checked if they contain HTML tags.
    (Large) duplicate content
-   A query is being executed, 500 results are examined. The fields are checked for duplicate content.
-   Nr of all fields

Extensions

-   Disabled/Error/Slow/Timeout extensions

Query Pipelines

-   Nr of Query pipelines
-   For each query pipeline:
-   ML, Query Suggest enabled
-   ML, ART enabled
-   ML, Recommendations enabled
-   Nr of Thesaurus entries
-   Ranking expressions. For each expression a Query Check is made
-   Filter expressions. For each expression a Query Check is made
-   Warning if a filter is applied, need to set the query pipeline in the search token
-   Nr of Featured results

Analytics

-   Top Queries
-   Low Usage Page/Tab combinations
-   Low Click Through % Page/Tab combinations
-   Low Click Rank Page/Tab combinations
-   Custom Analytics Dimensions
-   Click Rank, last week
-   Click Through, last week
-   No of Searches, last week

Query Checks

-   Each q, aq, dq will be checked
-   Words which will influence caching will be reported
-   Words which should not be used in the basic (q) query will be reported
-   Number of nested queries
-   Number of requested results
-   filterFields, a new query is being executed to examine if they do not contain multiple words (like “this is a test”)
-   filterFields, filterFieldRange
-   duplicateFiltering
-   partialMatch
-   wildcardsEnabled
-   To many words in query

Facets

-   injectionDepth
-   maximumNumberOfValues
-   generateAutomaticRanges
-   Sorting
-   If a field is requested as sorted, field should have useCacheForSort enabled

Nested queries

-   If a field is used as a nested key, it should have useCacheForNestedQuery enabled
-   If a field is used as a nested key, it should be Int 32 format

Numeric queries

-   If a field is used with a query like < or >, it should have useCacheForNumericQuery enabled

Query format

-   If a query contains multiple OR’s on the same field, it should be rewritten
-   If a == is used, warning on usage
-   If a = is used, warning on usage

Queries with ==

-   Field will be checked with a query, if it only contains single values a recommendation is done to use =

Bad query syntax

-   If query contains +or or @date>=1y r or if it contains fields without @ (category=”Cat A”)

## Implementation

The Implementation checker will load all JS files/HTML files the page is loading. All of them are being checked. Based on that it will create the report.

General

-   Proper JS UI version
-   Hard coded Access tokens
-   Search alerts errors
-   Searches without analytics

Behavior

-   Searches executed, based upon HTTP requests. Searches are recorded for later analysis (See Query Checker). For both Search Box as full Search interface.
-   The original search is being re-executed with debug=1, to get the executionReport. The expressions (including Ranking Expressions) will be checked.
-   The current token is used to perform additional queries to check for proper field usage.
-   Analytics events, based upon HTTP requests
-   Visitor changed during events
-   Get token from requests
-   Get custom data from Analytic requests. Correlate that back to the Dimensions found in the org
-   Check if /topqueries or /querysuggest is being called
-   Check if /open or /click event is being called

Implementation

-   Check usage of Queries (See Query Check at Organization Checker)
-   Constant queries will be checked if they change during searches
-   Queries will be executed with Debug=1 so we can get the ExecutionReport to see which Ranking has been done on the querypipeline level
-   Load time
-   State in code
-   Partial matching and other settings which could influence performance
-   Using custom events

UI

-   Facets, Tabs, Sorts
-   Using recommendation components
-   Underscore templates
-   Raw field access in code
-   Cultures which are used

## Installation

You can load it manually in your browser from the extension page. (chrome://extensions/)

## Changes

0.9.4 Added Analytics overview of OriginLevel1/OriginLevel2 combinations
0.9.4 Removed unused components
0.9.5 Use Average Response time in Analytic report
0.9.5 Added Average Response time to Report
0.9.5 Added Version into Title
0.9.5 Added Content Gap info into Analytics Report
0.9.6 Added Detailed OriginLevel1/Level2 information
0.9.7 In stead of 100 days, use 50 days for Analytics
0.9.8 Fixed DocumentOpen, Recommendation counts, Added EmptyHubs
0.9.9 Fixed Failing Analytics call, chaning 50 days to 30 days (License restrictions). JS UI Version check only for 2.x
1.0.2 Removed detailed analytics call

## Build extension package

Bash command to build the package for the Chrome Web Store:

> `zip -r9 coveo_implementation_checker_v$(node -p -e "require('./manifest.json').version").zip manifest.json popup.html css dependencies images js`

## Usage

TBD

## Dependencies

Google Chrome or Chromium
