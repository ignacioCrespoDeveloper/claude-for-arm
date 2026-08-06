# RCA documentation index

`WebFetch` these when you need authoritative detail — a field list, an API shape, or a name
marked ⚠︎ in the domain map. Prefer the Developer Guide over blogs; prefer the org over
both.

The product is documented under `revenue_lifecycle_management` even where the UI says
Revenue Cloud or Agentforce Revenue Management. Object pages follow a fixed pattern, so you
can usually construct the URL:

```
https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/
  revenue_lifecycle_management_dev_guide/sforce_api_objects_<objectname_lowercase>.htm
```

e.g. `…sforce_api_objects_productqualification.htm`. If the page 404s, the object name is
wrong — that is a useful signal in itself, so check before putting it in a ticket.

## Core

| Topic | URL |
|-------|-----|
| Salesforce Pricing overview | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/pricing_overview.htm |
| Price Context API (POST) | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/connect_resources_price_context.htm |
| Pricing Input request body | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/connect_requests_core_pricing_input.htm |
| Run Salesforce Pricing invocable action | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/actions_obj_run_salesforce_pricing.htm |

## Objects

| Object | URL |
|--------|-----|
| ProductQualification | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/sforce_api_objects_productqualification.htm |
| ProductDisqualification | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/sforce_api_objects_productdisqualification.htm |
| ProductCategoryQualification | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/sforce_api_objects_productcategoryqualification.htm |
| ProductConfigurationRule | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/sforce_api_objects_productconfigurationrule.htm |
| ProductClassification | https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/sforce_api_objects_productclassification.htm |

## Trailhead — useful when a ticket needs a Setup walkthrough

| Module | URL |
|--------|-----|
| Set up your product offerings | https://trailhead.salesforce.com/content/learn/modules/revenue-cloud-design/set-up-your-product-offerings |
| Configure pricing for products | https://trailhead.salesforce.com/content/learn/modules/revenue-cloud-design/configure-pricing-for-products |
| Create a pricing procedure with the List Price element | https://trailhead.salesforce.com/content/learn/modules/price-management-with-revenue-cloud/create-a-pricing-procedure-with-the-list-price-element |
| Product Configurator with Business Rules Engine | https://trailhead.salesforce.com/content/learn/modules/product-configuration-with-revenue-cloud/use-product-configurator-with-business-rules-engine |

## Practitioner sources

Useful for Setup navigation and gotchas the official docs omit. Treat as secondary — they
go stale across releases, and some block automated fetching.

- https://revenuecloud.info/architecture-1/ — pricing architecture, waterfall walkthroughs
- https://solvd.cloud/demystifying-context-definitions-in-salesforce-revenue-cloud-a-beginners-guide/ — context definitions
- https://www.stratuscarta.com/post/revenue-lifecycle-management-part-3-salesforce-pricing — pricing elements
- https://www.stratuscarta.com/post/revenue-lifecycle-management-part-4-product-configurator — configurator

## Checking a release

RCA changes shape every release. When a name or an element does not exist in the org, check
the release notes for the org's version before concluding the ticket is wrong:

```bash
sf org display -o <alias>          # API version the org is on
```

Then search the Salesforce release notes for that release plus the feature name.
