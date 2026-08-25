import type { BankBalanceWorkbookData } from "./types";

export const sampleBankBalanceWorkbook = {
  "metadata": {
    "title": "Mitrade Group Bank Balance Dashboard",
    "selectedMonth": "2026-04-30",
    "lastRefreshed": "2026-08-25T09:12:29.664Z",
    "dashboardView": "Bank balances",
    "workbookSheets": [
      "Dashboard",
      "Monthly Balances",
      "Summary by Country",
      "Summary by License",
      "Bank Mapping",
      "Statement Uploads",
      "Apr 2026 Raw",
      "Workbook Summary",
      "FX Rates",
      "XE Rates"
    ],
    "source": "Masked static sample extracted from the attached Mitrade workbook for presentation development."
  },
  "kpis": {
    "totalUsd": 79755165.56,
    "priorMonthUsd": 76388155.1,
    "movementUsd": 3367010.461,
    "movementPct": 0.04407765126,
    "accounts": 101,
    "currencies": 9
  },
  "countrySummary": [
    {
      "country": "Singapore",
      "priorMonthUsd": 1090400.8018625653,
      "currentMonthUsd": 1093146.0647153587,
      "movementUsd": 2745.2628527933794,
      "movementPct": 0.0025176640076787046
    },
    {
      "country": "Australia",
      "priorMonthUsd": 28834031.29714605,
      "currentMonthUsd": 30807100.76441541,
      "movementUsd": 1973069.4672693592,
      "movementPct": 0.06842849849665839
    },
    {
      "country": "Cayman",
      "priorMonthUsd": 42068571.50444923,
      "currentMonthUsd": 44282359.07190297,
      "movementUsd": 2213787.5674537397,
      "movementPct": 0.052623312089872275
    },
    {
      "country": "UK",
      "priorMonthUsd": 29820.329597890577,
      "currentMonthUsd": 32348.927213470935,
      "movementUsd": 2528.5976155803637,
      "movementPct": 0.08479442211662312
    },
    {
      "country": "Cyprus",
      "priorMonthUsd": 1500256.9642376786,
      "currentMonthUsd": 1308469.0090429273,
      "movementUsd": -191787.95519475103,
      "movementPct": -0.12783673715002797
    },
    {
      "country": "Mauritius",
      "priorMonthUsd": 1212989.783103902,
      "currentMonthUsd": 1197670.3507665405,
      "movementUsd": -15319.432337361177,
      "movementPct": -0.012629481757183893
    },
    {
      "country": "HongKong",
      "priorMonthUsd": 1652084.4149963201,
      "currentMonthUsd": 1034071.3678617781,
      "movementUsd": -618013.0471345425,
      "movementPct": -0.37408079243694037
    }
  ],
  "licenseSummary": [
    {
      "license": "ASIC",
      "clientFundsUsd": 7491730.5804023,
      "corporateFundsUsd": 23315370.184013106,
      "totalUsd": 30807100.764415406
    },
    {
      "license": "CIMA",
      "clientFundsUsd": 14669713.399999999,
      "corporateFundsUsd": 29612645.67190297,
      "totalUsd": 44282359.07190297
    },
    {
      "license": "FSC",
      "clientFundsUsd": 748067.21,
      "corporateFundsUsd": 449603.14076654054,
      "totalUsd": 1197670.3507665405
    },
    {
      "license": "CYSEC",
      "clientFundsUsd": 310204.257565095,
      "corporateFundsUsd": 998264.7514778326,
      "totalUsd": 1308469.0090429275
    }
  ],
  "topBanks": [
    {
      "bank": "OCBC SG - Mitrade Holding",
      "totalUsd": 27902184.83,
      "movementUsd": 2801526.71
    },
    {
      "bank": "WP AU - Mitrade Global",
      "totalUsd": 24890136.85,
      "movementUsd": 2483577.648
    },
    {
      "bank": "UOB SG - Mitrade Holding",
      "totalUsd": 15460953.63,
      "movementUsd": -587733.5387
    },
    {
      "bank": "NAB AU - Mitrade Global",
      "totalUsd": 4034971.347,
      "movementUsd": 201055.7625
    },
    {
      "bank": "DBS SG - Mitrade Global",
      "totalUsd": 1531704.699,
      "movementUsd": -894419.4396
    },
    {
      "bank": "DBS HK - H & W Tech",
      "totalUsd": 887978.2091,
      "movementUsd": -596095.3623
    },
    {
      "bank": "DBS HK - Mitrade Holding",
      "totalUsd": 829401.9694,
      "movementUsd": -6.670796928
    },
    {
      "bank": "SBM MU - Mitrade Int",
      "totalUsd": 781577.9787,
      "movementUsd": 2016.394788
    },
    {
      "bank": "DBS HK - Mitrade Group",
      "totalUsd": 597197.038,
      "movementUsd": -2.015806634
    },
    {
      "bank": "Alpha Bank CY- Mitrade EU",
      "totalUsd": 581304.4556,
      "movementUsd": -2016.28011
    }
  ],
  "concentration": [
    {
      "entityGroup": "Mitrade Global",
      "bank": "Airwallex AU",
      "totalUsd": 9349.375,
      "proportion": 0.0003034811705098602,
      "hhiIndex": 9.210082085403486e-8,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Global",
      "bank": "ANZ AU",
      "totalUsd": 276486.709770115,
      "proportion": 0.00897477214374806,
      "hhiIndex": 0.00008054653503219613,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Global",
      "bank": "DBS SG",
      "totalUsd": 1531704.6989129584,
      "proportion": 0.049719209562303114,
      "hhiIndex": 0.0024719997995002133,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Global",
      "bank": "NAB AU",
      "totalUsd": 4034971.347413793,
      "proportion": 0.13097536760338374,
      "hhiIndex": 0.017154546918841503,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Global",
      "bank": "UOB SG",
      "totalUsd": 64451.783417060105,
      "proportion": 0.0020921080471001966,
      "hhiIndex": 0.000004376916080741399,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Global",
      "bank": "Westpac AU",
      "totalUsd": 24890136.849901486,
      "proportion": 0.807935061472955,
      "hhiIndex": 0.6527590635573076,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "Mitrade Holding",
      "bank": "DBS HK",
      "totalUsd": 829401.9694070187,
      "proportion": 0.01872985059491268,
      "hhiIndex": 0.0003508073033077509,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Holding",
      "bank": "ECM CY",
      "totalUsd": 58.64414731409805,
      "proportion": 0.0000013243230158283865,
      "hhiIndex": 1.7538314502527928e-12,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Holding",
      "bank": "MCB MU",
      "totalUsd": 89760,
      "proportion": 0.002026992280475691,
      "hhiIndex": 0.000004108697705108042,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Holding",
      "bank": "OCBC SG",
      "totalUsd": 27902184.83,
      "proportion": 0.6300970728477711,
      "hhiIndex": 0.3970223212113293,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "Mitrade Holding",
      "bank": "UOB SG",
      "totalUsd": 15460953.628348637,
      "proportion": 0.34914475995382477,
      "hhiIndex": 0.12190206340321393,
      "concentrationLevel": "Moderate"
    },
    {
      "entityGroup": "Mitrade EU",
      "bank": "Alpha Bank CY",
      "totalUsd": 581304.4556204551,
      "proportion": 0.4442630674498336,
      "hhiIndex": 0.19736967309993542,
      "concentrationLevel": "Moderate"
    },
    {
      "entityGroup": "Mitrade EU",
      "bank": "Bank of Cyprus CY",
      "totalUsd": 219397.60213699273,
      "proportion": 0.16767504665431082,
      "hhiIndex": 0.02811492127052531,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade EU",
      "bank": "DBS HK",
      "totalUsd": 108668.66,
      "proportion": 0.08305023600022832,
      "hhiIndex": 0.006897341699693619,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade EU",
      "bank": "Hellenic CY",
      "totalUsd": 248478.0590546563,
      "proportion": 0.18989984274553373,
      "hhiIndex": 0.03606195027477844,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade EU",
      "bank": "Revolut Bank CY",
      "totalUsd": 150620.23223082337,
      "proportion": 0.11511180715009346,
      "hhiIndex": 0.013250728145360309,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade International",
      "bank": "MCB MU",
      "totalUsd": 416092.3720381362,
      "proportion": 0.34741811198033423,
      "hhiIndex": 0.12069934453198006,
      "concentrationLevel": "Moderate"
    },
    {
      "entityGroup": "Mitrade International",
      "bank": "SBM MU",
      "totalUsd": 781577.9787284043,
      "proportion": 0.6525818880196657,
      "hhiIndex": 0.4258631205713114,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "Mitrade Group",
      "bank": "DBS HK",
      "totalUsd": 597197.0380353108,
      "proportion": 0.5463103763638514,
      "hhiIndex": 0.2984550273228129,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "Mitrade Group",
      "bank": "UOB SG",
      "totalUsd": 495949.026680048,
      "proportion": 0.45368962363614845,
      "hhiIndex": 0.20583427459511003,
      "concentrationLevel": "Moderate"
    },
    {
      "entityGroup": "Mitrade Services",
      "bank": "Barclays UK",
      "totalUsd": 1665.8066268332427,
      "proportion": 0.05149495733940622,
      "hhiIndex": 0.0026517306313872664,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "Mitrade Services",
      "bank": "Habib UK",
      "totalUsd": 13632.210755024442,
      "proportion": 0.4214115251818191,
      "hhiIndex": 0.17758767355606697,
      "concentrationLevel": "Moderate"
    },
    {
      "entityGroup": "Mitrade Services",
      "bank": "Revolut UK",
      "totalUsd": 17050.90983161325,
      "proportion": 0.5270935174787746,
      "hhiIndex": 0.2778275761681473,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "Airwallex",
      "totalUsd": 7999.674452018944,
      "proportion": 0.007736095109721907,
      "hhiIndex": 0.00005984716754666321,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "DBS HK",
      "totalUsd": 887978.2091011362,
      "proportion": 0.8587204294586273,
      "hhiIndex": 0.7374007759696092,
      "concentrationLevel": "High"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "HSBC",
      "totalUsd": 45875.38844995085,
      "proportion": 0.04436385135081209,
      "hhiIndex": 0.0019681513066769516,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "OSL HK",
      "totalUsd": 1010.02,
      "proportion": 0.0009767410948515955,
      "hhiIndex": 9.540231663718935e-7,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "Paypal",
      "totalUsd": 0,
      "proportion": 0,
      "hhiIndex": 0,
      "concentrationLevel": "Low"
    },
    {
      "entityGroup": "H&W Technology",
      "bank": "SCB",
      "totalUsd": 91208.07585867197,
      "proportion": 0.08820288298598705,
      "hhiIndex": 0.007779748567039725,
      "concentrationLevel": "Low"
    }
  ],
  "monthlyBalances": [
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd SGD (acct ...5734)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...5734",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 350501.24,
      "balanceUsd": 275097.1195353583,
      "priorMonthUsd": 100105.18805738658,
      "movementUsd": 174991.9314779717,
      "movementPct": 1.7480805428151769,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd USD (acct ...1054)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...1054",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 142756.74,
      "balanceUsd": 142756.74,
      "priorMonthUsd": 315945.42,
      "movementUsd": -173188.68,
      "movementPct": -0.5481601220869098,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd HKD (acct ...2366)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2366",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 60300,
      "balanceUsd": 7697.9050974685,
      "priorMonthUsd": 7691.032230909532,
      "movementUsd": 6.872866558967871,
      "movementPct": 0.0008936208239183383,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd GBP (acct ...2374)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2374",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 1859.46,
      "balanceUsd": 2525.067897881586,
      "priorMonthUsd": 2475.2274225444958,
      "movementUsd": 49.84047533709008,
      "movementPct": 0.020135715564210597,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd EUR (acct ...2382)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2382",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 15458.58,
      "balanceUsd": 18131.104855735397,
      "priorMonthUsd": 17824.25149700599,
      "movementUsd": 306.8533587294078,
      "movementPct": 0.017215497592196292,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd CNH (acct ...2390)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2390",
      "fundType": "Corporate Funds",
      "currency": "CNH",
      "fxUnitsPerUsd": 6.8326,
      "balanceLocal": 55000,
      "balanceUsd": 8049.644352076808,
      "priorMonthUsd": 7967.088680939826,
      "movementUsd": 82.5556711369818,
      "movementPct": 0.010362087638673459,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Fixed Deposit SGD (acct ...6715)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...6715",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 53119.07,
      "balanceUsd": 41691.444941527356,
      "priorMonthUsd": 41193.540131834045,
      "movementUsd": 497.9048096933111,
      "movementPct": 0.01208696334667615,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Savings USD (acct ...5487)",
      "bank": "DBS HK - Mitrade Group",
      "maskedAccountNo": "...5487",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 597158.74,
      "balanceUsd": 597158.74,
      "priorMonthUsd": 597160.79,
      "movementUsd": -2.050000000046566,
      "movementPct": -0.000003432911260041983,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Savings HKD (acct ...5487)",
      "bank": "DBS HK - Mitrade Group",
      "maskedAccountNo": "...5487",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 300,
      "balanceUsd": 38.298035310788556,
      "priorMonthUsd": 38.26384194482354,
      "movementUsd": 0.03419336596501665,
      "movementPct": 0.0008936208239184002,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd SGD (acct ...2193)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...2193",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 19155,
      "balanceUsd": 15034.141747115611,
      "priorMonthUsd": 14854.594804187669,
      "movementUsd": 179.54694292794193,
      "movementPct": 0.012086963346676123,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd USD (acct ...7622)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7622",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 36278.8,
      "balanceUsd": 36278.8,
      "priorMonthUsd": 36278.8,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...7673)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7673",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 10885.26,
      "balanceUsd": 7819.870689655173,
      "priorMonthUsd": 7460.2563223905145,
      "movementUsd": 359.61436726465854,
      "movementPct": 0.04820402298850586,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd GBP (acct ...7681)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7681",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 3335.63,
      "balanceUsd": 4529.6442151004885,
      "priorMonthUsd": 4421.397495056032,
      "movementUsd": 108.2467200444562,
      "movementPct": 0.02448246740210459,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd EUR (acct ...7665)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7665",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 672.98,
      "balanceUsd": 789.3267651888342,
      "priorMonthUsd": 797.9963150621834,
      "movementUsd": -8.669549873349183,
      "movementPct": -0.010864147753205619,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Structured Deposit (acct ...4467)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...4467",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": null,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Structured Deposit (acct ...4467)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...4467",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": null,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving USD (acct ...4205)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4205",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 1452979.85,
      "balanceUsd": 1452979.85,
      "priorMonthUsd": 2348339.47,
      "movementUsd": -895359.6200000001,
      "movementPct": -0.38127350472033755,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving SGD (acct ...4205)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4205",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 50030.13,
      "balanceUsd": 39267.035554509064,
      "priorMonthUsd": 38798.084528887164,
      "movementUsd": 468.95102562190004,
      "movementPct": 0.012086963346676095,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving SGD (acct ...4213)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4213",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 50273.2,
      "balanceUsd": 39457.8133584491,
      "priorMonthUsd": 38986.58394726638,
      "movementUsd": 471.2294111827214,
      "movementPct": 0.012086963346676147,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Chequing AUD (acct ...0203)",
      "bank": "ANZ AU - Mitrade Global",
      "maskedAccountNo": "...0203",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 384869.5,
      "balanceUsd": 276486.709770115,
      "priorMonthUsd": 94585.31971763415,
      "movementUsd": 181901.39005248083,
      "movementPct": 1.9231461139583987,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...0993)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 208006.64,
      "balanceUsd": 149430.0574712644,
      "priorMonthUsd": 141826.98238640258,
      "movementUsd": 7603.0750848618045,
      "movementPct": 0.053608100214298404,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client AUD (acct ...5459)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...5459",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1420965.79,
      "balanceUsd": 1020808.7571839081,
      "priorMonthUsd": 911497.3545336166,
      "movementUsd": 109311.40265029157,
      "movementPct": 0.11992509040931078,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd USD (acct ...06)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...06",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 1297425.55,
      "balanceUsd": 1297425.55,
      "priorMonthUsd": 1297425.55,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Wholesale Client Trust AUD (acct ...1968)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...1968",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 4488.37,
      "balanceUsd": 3224.403735632184,
      "priorMonthUsd": 4851.374134740594,
      "movementUsd": -1626.9703991084098,
      "movementPct": -0.33536279699759847,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...4383)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...4383",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 111730.52,
      "balanceUsd": 80266.17816091955,
      "priorMonthUsd": 76574.95716537592,
      "movementUsd": 3691.2209955436265,
      "movementPct": 0.04820402298850578,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving EUR (acct ...4759)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...4759",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 17850.98,
      "balanceUsd": 20937.11001642036,
      "priorMonthUsd": 28276.47397512667,
      "movementUsd": -7339.363958706312,
      "movementPct": -0.25955725473983654,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving AUD House (acct ...3746)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...3746",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 20680363.66,
      "balanceUsd": 14856583.08908046,
      "priorMonthUsd": 12961249.99657323,
      "movementUsd": 1895333.0925072301,
      "movementPct": 0.1462307333789819,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust USD (acct ...9491)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9491",
      "fundType": "Client Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 997768.26,
      "balanceUsd": 997768.26,
      "priorMonthUsd": 997768.26,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust AUD (acct ...9644)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9644",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 2384109.6,
      "balanceUsd": 1712722.4137931035,
      "priorMonthUsd": 1454690.8847919952,
      "movementUsd": 258031.52900110837,
      "movementPct": 0.17737894125734077,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust BPAY AUD (acct ...9415)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9415",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 164559.36,
      "balanceUsd": 118217.93103448275,
      "priorMonthUsd": 111033.7331231581,
      "movementUsd": 7184.197911324649,
      "movementPct": 0.06470284038235452,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...3519)",
      "bank": "Airwallex AU - Mitrade Global",
      "maskedAccountNo": "...3519",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 13014.33,
      "balanceUsd": 9349.375,
      "priorMonthUsd": 9034.007264752245,
      "movementUsd": 315.36773524775526,
      "movementPct": 0.03490895302666155,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...5519)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1000000,
      "balanceUsd": 718390.8045977012,
      "priorMonthUsd": 685353.9853334246,
      "movementUsd": 33036.819264276535,
      "movementPct": 0.048204022988505894,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...8466)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1000000,
      "balanceUsd": 718390.8045977012,
      "priorMonthUsd": 685353.9853334246,
      "movementUsd": 33036.819264276535,
      "movementPct": 0.048204022988505894,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...8474)-House Money *Terminated",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": null,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...3009)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 2000000,
      "balanceUsd": 1436781.6091954024,
      "priorMonthUsd": 1370707.9706668493,
      "movementUsd": 66073.63852855307,
      "movementPct": 0.048204022988505894,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...5661)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 3000000,
      "balanceUsd": 2155172.413793104,
      "priorMonthUsd": 2056061.956000274,
      "movementUsd": 99110.45779282972,
      "movementPct": 0.04820402298850595,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Tailored Deposit AUD (acct ...0222)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 2000000,
      "balanceUsd": 1436781.6091954024,
      "priorMonthUsd": 1370707.9706668493,
      "movementUsd": 66073.63852855307,
      "movementPct": 0.048204022988505894,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Tailored Deposit AUD (acct ...0209)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1000000,
      "balanceUsd": 718390.8045977012,
      "priorMonthUsd": 685353.9853334246,
      "movementUsd": 33036.819264276535,
      "movementPct": 0.048204022988505894,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...0757)-Client Money",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1020194.52,
      "balanceUsd": 732898.3620689656,
      "priorMonthUsd": 685353.9853334246,
      "movementUsd": 47544.37673554092,
      "movementPct": 0.06937200009482776,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...0152)-Client Money",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 1045277.91,
      "balanceUsd": 750918.0387931035,
      "priorMonthUsd": 716385.3813994928,
      "movementUsd": 34532.65739361069,
      "movementPct": 0.04820402298850585,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd SGD (acct ...8741)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...8741",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "fxUnitsPerUsd": 1.2741,
      "balanceLocal": 285163.25,
      "balanceUsd": 223815.43834863824,
      "priorMonthUsd": 221142.49709189608,
      "movementUsd": 2672.9412567421678,
      "movementPct": 0.012086963346676072,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client USD (acct ...3998)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...3998",
      "fundType": "Client Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 5565988.88,
      "balanceUsd": 5565988.88,
      "priorMonthUsd": 10311557.38,
      "movementUsd": -4745568.500000001,
      "movementPct": -0.460218405922307,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Business USD (acct ...3128)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...3128",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 3671149.31,
      "balanceUsd": 3671149.31,
      "priorMonthUsd": 5515987.29,
      "movementUsd": -1844837.98,
      "movementPct": -0.3344529062538866,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client Money Fixed Deposit (acct ...0828)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...0828",
      "fundType": "Client Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 6000000,
      "balanceUsd": 6000000,
      "priorMonthUsd": 0,
      "movementUsd": 6000000,
      "movementPct": null,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Saving USD (acct ...0993)",
      "bank": "DBS HK - Mitrade Holding",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 795591.32,
      "balanceUsd": 795591.32,
      "priorMonthUsd": 795589.97,
      "movementUsd": 1.349999999976717,
      "movementPct": 0.000001696853971118712,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Saving HKD (acct ...0993)",
      "bank": "DBS HK - Mitrade Holding",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 264848.96,
      "balanceUsd": 33810.649407018755,
      "priorMonthUsd": 33818.670203946276,
      "movementUsd": -8.020796927521587,
      "movementPct": -0.0002371706775917418,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...0039)",
      "bank": "ECM CY - Mitrade Holding",
      "maskedAccountNo": "...0039",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate EUR (acct ...0038)",
      "bank": "ECM CY - Mitrade Holding",
      "maskedAccountNo": "...0038",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 50,
      "balanceUsd": 58.64414731409805,
      "priorMonthUsd": 57.577153385536626,
      "movementUsd": 1.0669939285614234,
      "movementPct": 0.0185315505512548,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...5201)",
      "bank": "OCBC SG - Mitrade Holding",
      "maskedAccountNo": "...5201",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 24798460.31,
      "balanceUsd": 24798460.31,
      "priorMonthUsd": 22005595.48,
      "movementUsd": 2792864.829999998,
      "movementPct": 0.12691612151728957,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client Time Deposit USD (acct ...6401)",
      "bank": "OCBC SG - Mitrade Holding",
      "maskedAccountNo": "...6401",
      "fundType": "Client Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 3103724.52,
      "balanceUsd": 3103724.52,
      "priorMonthUsd": 3095062.64,
      "movementUsd": 8661.879999999888,
      "movementPct": 0.002798612179299831,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...9857)",
      "bank": "MCB MU - Mitrade Holding",
      "maskedAccountNo": "...9857",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 89760,
      "balanceUsd": 89760,
      "priorMonthUsd": 89760,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...6097)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...6097",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 5192.29,
      "balanceUsd": 7050.909831613253,
      "priorMonthUsd": 15091.390903098221,
      "movementUsd": -8040.481071484968,
      "movementPct": -0.5327859521440319,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd USD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 10000,
      "balanceUsd": 10000,
      "priorMonthUsd": 0,
      "movementUsd": 10000,
      "movementPct": null,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd EUR (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd AUD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "fxUnitsPerUsd": 1.392,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd HKD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd USD (acct ...2585)",
      "bank": "Habib UK - Mitrade Services",
      "maskedAccountNo": "...2585",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...2585)",
      "bank": "Habib UK - Mitrade Services",
      "maskedAccountNo": "...2585",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 10038.76,
      "balanceUsd": 13632.210755024442,
      "priorMonthUsd": 8115.359261700725,
      "movementUsd": 5516.851493323717,
      "movementPct": 0.6798037296216455,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...8224)",
      "bank": "Barclays UK - Mitrade Services",
      "maskedAccountNo": "...8224",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 1226.7,
      "balanceUsd": 1665.8066268332427,
      "priorMonthUsd": 6613.579433091628,
      "movementUsd": -4947.772806258385,
      "movementPct": -0.7481232903171567,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...1801)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1801",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 180500.25,
      "balanceUsd": 180500.25,
      "priorMonthUsd": 180500.25,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...1801)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1801",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 2526.63,
      "balanceUsd": 2963.4412385643914,
      "priorMonthUsd": 3474.009672961769,
      "movementUsd": -510.5684343973776,
      "movementPct": -0.14696805203829275,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...1802)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1802",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 1956.76,
      "balanceUsd": 2295.05043396669,
      "priorMonthUsd": 1695.2901888530632,
      "movementUsd": 599.7602451136268,
      "movementPct": 0.3537802843767947,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...7301)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...7301",
      "fundType": "Client Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 53474.49,
      "balanceUsd": 62719.31738212526,
      "priorMonthUsd": 61578.17825886688,
      "movementUsd": 1141.1391232583774,
      "movementPct": 0.018531550551254907,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...7365)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...7365",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 1200.97,
      "balanceUsd": 1408.5972319962468,
      "priorMonthUsd": 2189.336711192999,
      "movementUsd": -780.739479196752,
      "movementPct": -0.35661005235294146,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...7381)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...7381",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 172246.57,
      "balanceUsd": 172246.57,
      "priorMonthUsd": 172246.57,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...8852)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...8852",
      "fundType": "Client Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 39000,
      "balanceUsd": 45742.43490499648,
      "priorMonthUsd": 44910.17964071857,
      "movementUsd": 832.2552642779119,
      "movementPct": 0.018531550551254838,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...9484)",
      "bank": "DBS HK - Mitrade EU",
      "maskedAccountNo": "...9484",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 108668.66,
      "balanceUsd": 108668.66,
      "priorMonthUsd": 258717.44,
      "movementUsd": -150048.78,
      "movementPct": -0.5799716478332501,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...6800)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6800",
      "fundType": "Client Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 172005.66,
      "balanceUsd": 201742.50527797325,
      "priorMonthUsd": 193748.4569322893,
      "movementUsd": 7994.048345683957,
      "movementPct": 0.04125993296802202,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...6798)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6798",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 189959.37,
      "balanceUsd": 189959.37,
      "priorMonthUsd": 189959.37,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...6780)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6780",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 161655.16,
      "balanceUsd": 189602.58034248182,
      "priorMonthUsd": 199612.90879778904,
      "movementUsd": -10010.32845530723,
      "movementPct": -0.05014870288498149,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...8479)",
      "bank": "Revolut Bank CY-Mitrade EU",
      "maskedAccountNo": "...8479",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 528.81,
      "balanceUsd": 620.2322308233637,
      "priorMonthUsd": 14816.44403500691,
      "movementUsd": -14196.211804183547,
      "movementPct": -0.9581389279804293,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD(acct ...5583)",
      "bank": "Revolut Bank CY-Mitrade EU",
      "maskedAccountNo": "...5583",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 150000,
      "balanceUsd": 150000,
      "priorMonthUsd": 176808.53,
      "movementUsd": -26808.53,
      "movementPct": -0.15162464163917883,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Client USD (acct ...7047)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7047",
      "fundType": "Client Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 748067.21,
      "balanceUsd": 748067.21,
      "priorMonthUsd": 748067.21,
      "movementUsd": 0,
      "movementPct": 1,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving EUR (acct ...7054)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7054",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving GBP (acct ...7061)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7061",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "fxUnitsPerUsd": 0.7364,
      "balanceLocal": 27.48,
      "balanceUsd": 37.316675719717544,
      "priorMonthUsd": 36.22940013183916,
      "movementUsd": 1.0872755878783877,
      "movementPct": 0.7585,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving MUR (acct ...9355)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...9355",
      "fundType": "Corporate Funds",
      "currency": "MUR",
      "fxUnitsPerUsd": 47.0194,
      "balanceLocal": 99815.7,
      "balanceUsd": 2122.8620526846366,
      "priorMonthUsd": 107.55453979690019,
      "movementUsd": 2015.3075128877365,
      "movementPct": 928.0472975709462,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...6277)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...6277",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 31350.59,
      "balanceUsd": 31350.59,
      "priorMonthUsd": 31350.59,
      "movementUsd": 0,
      "movementPct": 1,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...6284)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...6284",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...1319)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1319",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 314518.08,
      "balanceUsd": 314518.08,
      "priorMonthUsd": 338838.86,
      "movementUsd": -24320.77999999997,
      "movementPct": 0.9282231677913213,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...1327)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1327",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 90769.55,
      "balanceUsd": 90769.55,
      "priorMonthUsd": 90769.55,
      "movementUsd": 0,
      "movementPct": 1,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...1335)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1335",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 8.93,
      "balanceUsd": 10.47384471029791,
      "priorMonthUsd": 10.28327959465684,
      "movementUsd": 0.19056511564107126,
      "movementPct": 0.8684000000000001,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...1343)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1343",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "fxUnitsPerUsd": 0.8526,
      "balanceLocal": 8.93,
      "balanceUsd": 10.47384471029791,
      "priorMonthUsd": 10.28327959465684,
      "movementUsd": 0.19056511564107126,
      "movementPct": 0.8684000000000001,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate MUR (acct ...1351)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1351",
      "fundType": "Corporate Funds",
      "currency": "MUR",
      "fxUnitsPerUsd": 47.0194,
      "balanceLocal": 507047.54,
      "balanceUsd": 10783.794348715637,
      "priorMonthUsd": 3799.222604783742,
      "movementUsd": 6984.571743931895,
      "movementPct": 133.46086627342066,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9601)",
      "bank": "Airwallex - H & W Tech",
      "maskedAccountNo": "...9601",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 16028.69,
      "balanceUsd": 2046.2244520189447,
      "priorMonthUsd": 965.8571738326339,
      "movementUsd": 1080.3672781863108,
      "movementPct": 1.1185580098756087,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...9601)",
      "bank": "Airwallex - H & W Tech",
      "maskedAccountNo": "...9601",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 5953.45,
      "balanceUsd": 5953.45,
      "priorMonthUsd": 6154.14,
      "movementUsd": -200.6900000000005,
      "movementPct": -0.03261056784538546,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9286)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...9286",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 353405.3,
      "balanceUsd": 45115.76219473274,
      "priorMonthUsd": 122728.90705712792,
      "movementUsd": -77613.14486239517,
      "movementPct": -0.6323949811291627,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate CNY (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "CNY",
      "fxUnitsPerUsd": 6.829,
      "balanceLocal": 14417.69,
      "balanceUsd": 2111.2446917557477,
      "priorMonthUsd": 2036.312500906073,
      "movementUsd": 74.93219084967473,
      "movementPct": 0.036797982046632365,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 8776.76,
      "balanceUsd": 1120.4422146477218,
      "priorMonthUsd": 1119.441858092165,
      "movementUsd": 1.0003565555568912,
      "movementPct": 0.0008936208239182447,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 839630.76,
      "balanceUsd": 839630.76,
      "priorMonthUsd": 1358188.91,
      "movementUsd": -518558.1499999999,
      "movementPct": -0.3818011958292311,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9461) -Credit Card",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": -2662,
      "balanceUsd": -339.8312333243971,
      "priorMonthUsd": -531.4567044628394,
      "movementUsd": 191.62547113844232,
      "movementPct": -0.3605664761198646,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Savings HKD (acct ...9838)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9838",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 105601.23,
      "balanceUsd": 13481.065451342345,
      "priorMonthUsd": 14339.152838539341,
      "movementUsd": -858.0873871969961,
      "movementPct": -0.05984226522020985,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Current HKD (acct ...9001)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9001",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 2306.94,
      "balanceUsd": 294.50423193290186,
      "priorMonthUsd": 294.2412917873041,
      "movementUsd": 0.26294014559778134,
      "movementPct": 0.0008936208239183875,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Savings USD (acct ...9838)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9838",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 32439.65,
      "balanceUsd": 32439.65,
      "priorMonthUsd": 59801.92,
      "movementUsd": -27362.269999999997,
      "movementPct": -0.45754835296258045,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology OSL USD (acct ...6862)",
      "bank": "OSL HK - H & W Tech",
      "maskedAccountNo": "...6862",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 1000,
      "balanceUsd": 1000,
      "priorMonthUsd": 1000,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology OSL USDT",
      "bank": "OSL HK - H & W Tech",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 10.02,
      "balanceUsd": 10.02,
      "priorMonthUsd": 10.02,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9583)",
      "bank": "Paypal - H & W Tech",
      "maskedAccountNo": "...9583",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...9583)",
      "bank": "Paypal - H & W Tech",
      "maskedAccountNo": "...9583",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 0,
      "balanceUsd": 0,
      "priorMonthUsd": 0,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving HKD (acct ...1511)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...1511",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 77967.79,
      "balanceUsd": 9953.377248413823,
      "priorMonthUsd": 3958.663571547007,
      "movementUsd": 5994.713676866815,
      "movementPct": 1.5143276432869843,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving CNY (acct ...2784)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...2784",
      "fundType": "Corporate Funds",
      "currency": "CNY",
      "fxUnitsPerUsd": 6.829,
      "balanceLocal": 173747.43,
      "balanceUsd": 25442.587494508713,
      "priorMonthUsd": 25180.857942272287,
      "movementUsd": 261.72955223642566,
      "movementPct": 0.010393988673318711,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving USD (acct ...2784)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...2784",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "fxUnitsPerUsd": 1,
      "balanceLocal": 51849.91,
      "balanceUsd": 51849.91,
      "priorMonthUsd": 51849.91,
      "movementUsd": 0,
      "movementPct": 0,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    },
    {
      "monthEnd": "2026-04-30",
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Cheque HKD (acct ...8846)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...8846",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "fxUnitsPerUsd": 7.8333,
      "balanceLocal": 31037.11,
      "balanceUsd": 3962.2011157494285,
      "priorMonthUsd": 4987.537466678571,
      "movementUsd": -1025.3363509291426,
      "movementPct": -0.2055796789055423,
      "sourceWorkbook": "59._Group_bank_balance_as_at_30.04.2026---27150b09-18a0-4492-8f70-403605ab1f08.xlsx",
      "statementFileRef": null,
      "notes": null
    }
  ],
  "bankMapping": [
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd SGD (acct ...5734)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...5734",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd USD (acct ...1054)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...1054",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd HKD (acct ...2366)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2366",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd GBP (acct ...2374)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2374",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd EUR (acct ...2382)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2382",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd CNH (acct ...2390)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...2390",
      "fundType": "Corporate Funds",
      "currency": "CNH",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Fixed Deposit SGD (acct ...6715)",
      "bank": "UOB SG - Mitrade Group",
      "maskedAccountNo": "...6715",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Savings USD (acct ...5487)",
      "bank": "DBS HK - Mitrade Group",
      "maskedAccountNo": "...5487",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Singapore",
      "accountEntity": "Mitrade Group Pte Ltd Savings HKD (acct ...5487)",
      "bank": "DBS HK - Mitrade Group",
      "maskedAccountNo": "...5487",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd SGD (acct ...2193)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...2193",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd USD (acct ...7622)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7622",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...7673)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7673",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd GBP (acct ...7681)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7681",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd EUR (acct ...7665)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...7665",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Structured Deposit (acct ...4467)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...4467",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Structured Deposit (acct ...4467)",
      "bank": "UOB SG - Mitrade Global",
      "maskedAccountNo": "...4467",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving USD (acct ...4205)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4205",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving SGD (acct ...4205)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4205",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving SGD (acct ...4213)",
      "bank": "DBS SG - Mitrade Global",
      "maskedAccountNo": "...4213",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Chequing AUD (acct ...0203)",
      "bank": "ANZ AU - Mitrade Global",
      "maskedAccountNo": "...0203",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...0993)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client AUD (acct ...5459)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...5459",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd USD (acct ...06)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...06",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Wholesale Client Trust AUD (acct ...1968)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...1968",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...4383)",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "...4383",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving EUR (acct ...4759)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...4759",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Saving AUD House (acct ...3746)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...3746",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust USD (acct ...9491)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9491",
      "fundType": "Client Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust AUD (acct ...9644)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9644",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Client Trust BPAY AUD (acct ...9415)",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "...9415",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd AUD (acct ...3519)",
      "bank": "Airwallex AU - Mitrade Global",
      "maskedAccountNo": "...3519",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...5519)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...8466)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...8474)-House Money *Terminated",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...3009)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...5661)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Tailored Deposit AUD (acct ...0222)-House Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Tailored Deposit AUD (acct ...0209)-Client Money",
      "bank": "WP AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...0757)-Client Money",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Australia",
      "accountEntity": "Mitrade Global Pty Ltd Term Deposit AUD (acct ...0152)-Client Money",
      "bank": "NAB AU - Mitrade Global",
      "maskedAccountNo": "Not provided",
      "fundType": "Client Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd SGD (acct ...8741)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...8741",
      "fundType": "Corporate Funds",
      "currency": "SGD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client USD (acct ...3998)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...3998",
      "fundType": "Client Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Business USD (acct ...3128)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...3128",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client Money Fixed Deposit (acct ...0828)",
      "bank": "UOB SG - Mitrade Holding",
      "maskedAccountNo": "...0828",
      "fundType": "Client Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Saving USD (acct ...0993)",
      "bank": "DBS HK - Mitrade Holding",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Saving HKD (acct ...0993)",
      "bank": "DBS HK - Mitrade Holding",
      "maskedAccountNo": "...0993",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...0039)",
      "bank": "ECM CY - Mitrade Holding",
      "maskedAccountNo": "...0039",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate EUR (acct ...0038)",
      "bank": "ECM CY - Mitrade Holding",
      "maskedAccountNo": "...0038",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...5201)",
      "bank": "OCBC SG - Mitrade Holding",
      "maskedAccountNo": "...5201",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Client Time Deposit USD (acct ...6401)",
      "bank": "OCBC SG - Mitrade Holding",
      "maskedAccountNo": "...6401",
      "fundType": "Client Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cayman",
      "accountEntity": "Mitrade Holding Ltd Corporate USD (acct ...9857)",
      "bank": "MCB MU - Mitrade Holding",
      "maskedAccountNo": "...9857",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...6097)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...6097",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd USD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd EUR (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd AUD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "AUD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd HKD (acct ...2220)",
      "bank": "Revolut UK - Mitrade Services",
      "maskedAccountNo": "...2220",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd USD (acct ...2585)",
      "bank": "Habib UK - Mitrade Services",
      "maskedAccountNo": "...2585",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...2585)",
      "bank": "Habib UK - Mitrade Services",
      "maskedAccountNo": "...2585",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "UK",
      "accountEntity": "Mitrade Services Ltd GBP (acct ...8224)",
      "bank": "Barclays UK - Mitrade Services",
      "maskedAccountNo": "...8224",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...1801)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1801",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...1801)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1801",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...1802)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...1802",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...7301)",
      "bank": "Eurobank - Mitrade EU",
      "maskedAccountNo": "...7301",
      "fundType": "Client Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...7365)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...7365",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...7381)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...7381",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...8852)",
      "bank": "Bank of Cyprus CY - Mitrade EU",
      "maskedAccountNo": "...8852",
      "fundType": "Client Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...9484)",
      "bank": "DBS HK - Mitrade EU",
      "maskedAccountNo": "...9484",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited Client EUR (acct ...6800)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6800",
      "fundType": "Client Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD (acct ...6798)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6798",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...6780)",
      "bank": "Alpha Bank CY- Mitrade EU",
      "maskedAccountNo": "...6780",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited EUR (acct ...8479)",
      "bank": "Revolut Bank CY-Mitrade EU",
      "maskedAccountNo": "...8479",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Cyprus",
      "accountEntity": "Mitrade EU Limited USD(acct ...5583)",
      "bank": "Revolut Bank CY-Mitrade EU",
      "maskedAccountNo": "...5583",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Client USD (acct ...7047)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7047",
      "fundType": "Client Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving EUR (acct ...7054)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7054",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving GBP (acct ...7061)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...7061",
      "fundType": "Corporate Funds",
      "currency": "GBP",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Saving MUR (acct ...9355)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...9355",
      "fundType": "Corporate Funds",
      "currency": "MUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...6277)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...6277",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...6284)",
      "bank": "SBM MU - Mitrade Int",
      "maskedAccountNo": "...6284",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...1319)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1319",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate USD (acct ...1327)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1327",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...1335)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1335",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate EUR (acct ...1343)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1343",
      "fundType": "Corporate Funds",
      "currency": "EUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "Mauritius",
      "accountEntity": "Mitrade International Ltd Corporate MUR (acct ...1351)",
      "bank": "MCB MU - Mitrade Int",
      "maskedAccountNo": "...1351",
      "fundType": "Corporate Funds",
      "currency": "MUR",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9601)",
      "bank": "Airwallex - H & W Tech",
      "maskedAccountNo": "...9601",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...9601)",
      "bank": "Airwallex - H & W Tech",
      "maskedAccountNo": "...9601",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9286)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...9286",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate CNY (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "CNY",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...1201)",
      "bank": "DBS HK - H & W Tech",
      "maskedAccountNo": "...1201",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9461) -Credit Card",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Savings HKD (acct ...9838)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9838",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Current HKD (acct ...9001)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9001",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Savings USD (acct ...9838)",
      "bank": "HSBC - H & W Tech",
      "maskedAccountNo": "...9838",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology OSL USD (acct ...6862)",
      "bank": "OSL HK - H & W Tech",
      "maskedAccountNo": "...6862",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology OSL USDT",
      "bank": "OSL HK - H & W Tech",
      "maskedAccountNo": "Not provided",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate HKD (acct ...9583)",
      "bank": "Paypal - H & W Tech",
      "maskedAccountNo": "...9583",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate USD (acct ...9583)",
      "bank": "Paypal - H & W Tech",
      "maskedAccountNo": "...9583",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving HKD (acct ...1511)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...1511",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving CNY (acct ...2784)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...2784",
      "fundType": "Corporate Funds",
      "currency": "CNY",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Saving USD (acct ...2784)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...2784",
      "fundType": "Corporate Funds",
      "currency": "USD",
      "defaultActive": true,
      "statementMatchingNotes": null
    },
    {
      "country": "HongKong",
      "accountEntity": "H&W Technology Service Corporate Cheque HKD (acct ...8846)",
      "bank": "SCB - H & W Tech",
      "maskedAccountNo": "...8846",
      "fundType": "Corporate Funds",
      "currency": "HKD",
      "defaultActive": true,
      "statementMatchingNotes": null
    }
  ],
  "statementUploads": {
    "columns": [
      "Month End",
      "Bank",
      "Entity / Account",
      "Statement Period",
      "Statement File / Link",
      "Status",
      "Populated At",
      "Notes"
    ],
    "rows": []
  },
  "fxRates": [
    {
      "currency": "USD",
      "name": "US Dollar",
      "unitsPerUsd": 1,
      "usdPerUnit": 1
    },
    {
      "currency": "EUR",
      "name": "Euro",
      "unitsPerUsd": 0.852559795289071,
      "usdPerUnit": 1.17293825667786
    },
    {
      "currency": "GBP",
      "name": "British Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "INR",
      "name": "Indian Rupee",
      "unitsPerUsd": 94.9136962646106,
      "usdPerUnit": 0.0105358872255073
    },
    {
      "currency": "AUD",
      "name": "Australian Dollar",
      "unitsPerUsd": 1.39199764522469,
      "usdPerUnit": 0.718392019864789
    },
    {
      "currency": "CAD",
      "name": "Canadian Dollar",
      "unitsPerUsd": 1.36095721862675,
      "usdPerUnit": 0.734776954274162
    },
    {
      "currency": "SGD",
      "name": "Singapore Dollar",
      "unitsPerUsd": 1.27408703118176,
      "usdPerUnit": 0.78487573888297
    },
    {
      "currency": "CHF",
      "name": "Swiss Franc",
      "unitsPerUsd": 0.782454297965518,
      "usdPerUnit": 1.27802991510191
    },
    {
      "currency": "MYR",
      "name": "Malaysian Ringgit",
      "unitsPerUsd": 3.97009772151524,
      "usdPerUnit": 0.251882968668674
    },
    {
      "currency": "JPY",
      "name": "Japanese Yen",
      "unitsPerUsd": 156.673535834174,
      "usdPerUnit": 0.00638269886918498
    },
    {
      "currency": "CNY",
      "name": "Chinese Yuan Renminbi",
      "unitsPerUsd": 6.82904669254256,
      "usdPerUnit": 0.146433322983721
    },
    {
      "currency": "NZD",
      "name": "New Zealand Dollar",
      "unitsPerUsd": 1.697454136569,
      "usdPerUnit": 0.589117536937556
    },
    {
      "currency": "THB",
      "name": "Thai Baht",
      "unitsPerUsd": 32.5411136935295,
      "usdPerUnit": 0.0307303557406776
    },
    {
      "currency": "HUF",
      "name": "Hungarian Forint",
      "unitsPerUsd": 310.932651274789,
      "usdPerUnit": 0.00321613055399653
    },
    {
      "currency": "AED",
      "name": "Emirati Dirham",
      "unitsPerUsd": 3.6725,
      "usdPerUnit": 0.272294077603812
    },
    {
      "currency": "HKD",
      "name": "Hong Kong Dollar",
      "unitsPerUsd": 7.83327266379334,
      "usdPerUnit": 0.127660563205231
    },
    {
      "currency": "MXN",
      "name": "Mexican Peso",
      "unitsPerUsd": 17.5201520093008,
      "usdPerUnit": 0.0570771303507604
    },
    {
      "currency": "ZAR",
      "name": "South African Rand",
      "unitsPerUsd": 16.7081937302619,
      "usdPerUnit": 0.0598508741366096
    },
    {
      "currency": "PHP",
      "name": "Philippine Peso",
      "unitsPerUsd": 61.3558742025916,
      "usdPerUnit": 0.0162983579485492
    },
    {
      "currency": "SEK",
      "name": "Swedish Krona",
      "unitsPerUsd": 9.24954367930283,
      "usdPerUnit": 0.108113441556867
    },
    {
      "currency": "IDR",
      "name": "Indonesian Rupiah",
      "unitsPerUsd": 17337.4925541418,
      "usdPerUnit": 0.0000576784674529597
    },
    {
      "currency": "BRL",
      "name": "Brazilian Real",
      "unitsPerUsd": 4.97974814464011,
      "usdPerUnit": 0.200813368659283
    },
    {
      "currency": "SAR",
      "name": "Saudi Arabian Riyal",
      "unitsPerUsd": 3.75,
      "usdPerUnit": 0.266666666666666
    },
    {
      "currency": "TRY",
      "name": "Turkish Lira",
      "unitsPerUsd": 45.1869696825937,
      "usdPerUnit": 0.0221302735506338
    },
    {
      "currency": "KES",
      "name": "Kenyan Shilling",
      "unitsPerUsd": 129.165847570618,
      "usdPerUnit": 0.00774198457880495
    },
    {
      "currency": "KRW",
      "name": "South Korean Won",
      "unitsPerUsd": 1477.94939141094,
      "usdPerUnit": 0.000676613154558248
    },
    {
      "currency": "EGP",
      "name": "Egyptian Pound",
      "unitsPerUsd": 53.6174177553134,
      "usdPerUnit": 0.0186506557358574
    },
    {
      "currency": "IQD",
      "name": "Iraqi Dinar",
      "unitsPerUsd": 1310.22108504348,
      "usdPerUnit": 0.000763229970434195
    },
    {
      "currency": "NOK",
      "name": "Norwegian Krone",
      "unitsPerUsd": 9.29406903570563,
      "usdPerUnit": 0.107595499469417
    },
    {
      "currency": "KWD",
      "name": "Kuwaiti Dinar",
      "unitsPerUsd": 0.307502975066333,
      "usdPerUnit": 3.25200105717443
    },
    {
      "currency": "RUB",
      "name": "Russian Ruble",
      "unitsPerUsd": 74.9421336013448,
      "usdPerUnit": 0.0133436286364557
    },
    {
      "currency": "DKK",
      "name": "Danish Krone",
      "unitsPerUsd": 6.37105750512097,
      "usdPerUnit": 0.156959813845066
    },
    {
      "currency": "PKR",
      "name": "Pakistani Rupee",
      "unitsPerUsd": 278.73206216083,
      "usdPerUnit": 0.00358767481662368
    },
    {
      "currency": "ILS",
      "name": "Israeli Shekel",
      "unitsPerUsd": 2.95144178458332,
      "usdPerUnit": 0.338817457021662
    },
    {
      "currency": "PLN",
      "name": "Polish Zloty",
      "unitsPerUsd": 3.63133043576272,
      "usdPerUnit": 0.275381163375169
    },
    {
      "currency": "QAR",
      "name": "Qatari Riyal",
      "unitsPerUsd": 3.64,
      "usdPerUnit": 0.274725274725274
    },
    {
      "currency": "XAU",
      "name": "Gold Ounce",
      "unitsPerUsd": 0.000216616541897731,
      "usdPerUnit": 4616.4526090169
    },
    {
      "currency": "OMR",
      "name": "Omani Rial",
      "unitsPerUsd": 0.384571147710474,
      "usdPerUnit": 2.60029907587568
    },
    {
      "currency": "COP",
      "name": "Colombian Peso",
      "unitsPerUsd": 3646.63143576841,
      "usdPerUnit": 0.000274225684063209
    },
    {
      "currency": "CLP",
      "name": "Chilean Peso",
      "unitsPerUsd": 902.412266115814,
      "usdPerUnit": 0.00110814096566331
    },
    {
      "currency": "TWD",
      "name": "Taiwan New Dollar",
      "unitsPerUsd": 31.6223499249506,
      "usdPerUnit": 0.031623203284174
    },
    {
      "currency": "ARS",
      "name": "Argentine Peso",
      "unitsPerUsd": 1379.22349717612,
      "usdPerUnit": 0.000725045652171269
    },
    {
      "currency": "CZK",
      "name": "Czech Koruna",
      "unitsPerUsd": 20.8008142771757,
      "usdPerUnit": 0.048075041038046
    },
    {
      "currency": "VND",
      "name": "Vietnamese Dong",
      "unitsPerUsd": 26313.9370139031,
      "usdPerUnit": 0.0000380026751402362
    },
    {
      "currency": "MAD",
      "name": "Moroccan Dirham",
      "unitsPerUsd": 9.23010640855403,
      "usdPerUnit": 0.108341112847111
    },
    {
      "currency": "JOD",
      "name": "Jordanian Dinar",
      "unitsPerUsd": 0.709,
      "usdPerUnit": 1.41043723554301
    },
    {
      "currency": "BHD",
      "name": "Bahraini Dinar",
      "unitsPerUsd": 0.376,
      "usdPerUnit": 2.6595744680851
    },
    {
      "currency": "XOF",
      "name": "CFA Franc",
      "unitsPerUsd": 559.242565638433,
      "usdPerUnit": 0.00178813284510701
    },
    {
      "currency": "LKR",
      "name": "Sri Lankan Rupee",
      "unitsPerUsd": 319.44362467557,
      "usdPerUnit": 0.00313044281605434
    },
    {
      "currency": "UAH",
      "name": "Ukrainian Hryvnia",
      "unitsPerUsd": 43.9854165724623,
      "usdPerUnit": 0.0227348079869286
    },
    {
      "currency": "NGN",
      "name": "Nigerian Naira",
      "unitsPerUsd": 1376.76147829122,
      "usdPerUnit": 0.00072634222831478
    },
    {
      "currency": "TND",
      "name": "Tunisian Dinar",
      "unitsPerUsd": 2.88046674485278,
      "usdPerUnit": 0.347165959054009
    },
    {
      "currency": "UGX",
      "name": "Ugandan Shilling",
      "unitsPerUsd": 3760.68720002045,
      "usdPerUnit": 0.000265908847721916
    },
    {
      "currency": "RON",
      "name": "Romanian Leu",
      "unitsPerUsd": 4.42740210577718,
      "usdPerUnit": 0.22586608943767
    },
    {
      "currency": "BDT",
      "name": "Bangladeshi Taka",
      "unitsPerUsd": 122.782641533298,
      "usdPerUnit": 0.00814447374247768
    },
    {
      "currency": "PEN",
      "name": "Peruvian Sol",
      "unitsPerUsd": 3.52041794286797,
      "usdPerUnit": 0.284057181911
    },
    {
      "currency": "GEL",
      "name": "Georgian Lari",
      "unitsPerUsd": 2.68391699697372,
      "usdPerUnit": 0.372589763814439
    },
    {
      "currency": "XAF",
      "name": "Central African CFA Franc BEAC",
      "unitsPerUsd": 559.242565638433,
      "usdPerUnit": 0.00178813284510701
    },
    {
      "currency": "FJD",
      "name": "Fijian Dollar",
      "unitsPerUsd": 2.19480492374701,
      "usdPerUnit": 0.45562135804433
    },
    {
      "currency": "VES",
      "name": "Venezuelan Bolívar",
      "unitsPerUsd": 485.883450604232,
      "usdPerUnit": 0.00205810673064996
    },
    {
      "currency": "BYN",
      "name": "Belarusian Ruble",
      "unitsPerUsd": 2.8100086199386,
      "usdPerUnit": 0.355870794453951
    },
    {
      "currency": "UZS",
      "name": "Uzbekistani Som",
      "unitsPerUsd": 11924.5769702824,
      "usdPerUnit": 0.0000838604172283953
    },
    {
      "currency": "DZD",
      "name": "Algerian Dinar",
      "unitsPerUsd": 132.492331683589,
      "usdPerUnit": 0.00754760662215637
    },
    {
      "currency": "IRR",
      "name": "Iranian Rial",
      "unitsPerUsd": 1314140.97991035,
      "usdPerUnit": 7.60953364431426e-7
    },
    {
      "currency": "DOP",
      "name": "Dominican Peso",
      "unitsPerUsd": 59.5535360081062,
      "usdPerUnit": 0.0167916141849895
    },
    {
      "currency": "ISK",
      "name": "Icelandic Krona",
      "unitsPerUsd": 122.601062094787,
      "usdPerUnit": 0.00815653619074571
    },
    {
      "currency": "CRC",
      "name": "Costa Rican Colon",
      "unitsPerUsd": 454.900866624539,
      "usdPerUnit": 0.00219828114951772
    },
    {
      "currency": "XAG",
      "name": "Silver Ounce",
      "unitsPerUsd": 0.0136639160951509,
      "usdPerUnit": 73.1854611105873
    },
    {
      "currency": "SYP",
      "name": "Syrian Pound",
      "unitsPerUsd": 110.528400633419,
      "usdPerUnit": 0.00904744838674196
    },
    {
      "currency": "JMD",
      "name": "Jamaican Dollar",
      "unitsPerUsd": 157.649908232254,
      "usdPerUnit": 0.00634316893180026
    },
    {
      "currency": "LYD",
      "name": "Libyan Dinar",
      "unitsPerUsd": 6.35642784224312,
      "usdPerUnit": 0.157321065355964
    },
    {
      "currency": "GHS",
      "name": "Ghanaian Cedi",
      "unitsPerUsd": 11.1916224585956,
      "usdPerUnit": 0.089352549525289
    },
    {
      "currency": "MUR",
      "name": "Mauritian Rupee",
      "unitsPerUsd": 47.0194176189125,
      "usdPerUnit": 0.0212678091444027
    },
    {
      "currency": "AOA",
      "name": "Angolan Kwanza",
      "unitsPerUsd": 916.428524219404,
      "usdPerUnit": 0.00109119257374903
    },
    {
      "currency": "UYU",
      "name": "Uruguayan Peso",
      "unitsPerUsd": 40.3065286072043,
      "usdPerUnit": 0.024809876577197
    },
    {
      "currency": "AFN",
      "name": "Afghan Afghani",
      "unitsPerUsd": 63.2069373149442,
      "usdPerUnit": 0.0158210481709824
    },
    {
      "currency": "LBP",
      "name": "Lebanese Pound",
      "unitsPerUsd": 89661.2351266478,
      "usdPerUnit": 0.0000111530919531443
    },
    {
      "currency": "XPF",
      "name": "CFP Franc",
      "unitsPerUsd": 101.73744573818,
      "usdPerUnit": 0.00982922259099648
    },
    {
      "currency": "TTD",
      "name": "Trinidadian Dollar",
      "unitsPerUsd": 6.79242497080546,
      "usdPerUnit": 0.147222826059632
    },
    {
      "currency": "TZS",
      "name": "Tanzanian Shilling",
      "unitsPerUsd": 2603.12351461783,
      "usdPerUnit": 0.00038415388066855
    },
    {
      "currency": "ALL",
      "name": "Albanian Lek",
      "unitsPerUsd": 81.4488518196234,
      "usdPerUnit": 0.012277643915897
    },
    {
      "currency": "XCD",
      "name": "East Caribbean Dollar",
      "unitsPerUsd": 2.70762053570126,
      "usdPerUnit": 0.369327971484381
    },
    {
      "currency": "GTQ",
      "name": "Guatemalan Quetzal",
      "unitsPerUsd": 7.64296902463071,
      "usdPerUnit": 0.130839206174634
    },
    {
      "currency": "NPR",
      "name": "Nepalese Rupee",
      "unitsPerUsd": 151.933099295575,
      "usdPerUnit": 0.00658184427643754
    },
    {
      "currency": "BOB",
      "name": "Bolivian Bolíviano",
      "unitsPerUsd": 6.91683982290234,
      "usdPerUnit": 0.144574693878106
    },
    {
      "currency": "BBD",
      "name": "Barbadian or Bajan Dollar",
      "unitsPerUsd": 2,
      "usdPerUnit": 0.5
    },
    {
      "currency": "CUC",
      "name": "Cuban Convertible Peso",
      "unitsPerUsd": 1,
      "usdPerUnit": 1
    },
    {
      "currency": "LAK",
      "name": "Lao Kip",
      "unitsPerUsd": 21957.6109540324,
      "usdPerUnit": 0.0000455422952020357
    },
    {
      "currency": "BND",
      "name": "Bruneian Dollar",
      "unitsPerUsd": 1.27408703118176,
      "usdPerUnit": 0.78487573888297
    },
    {
      "currency": "BWP",
      "name": "Botswana Pula",
      "unitsPerUsd": 13.5173319435245,
      "usdPerUnit": 0.0739790961839214
    },
    {
      "currency": "HNL",
      "name": "Honduran Lempira",
      "unitsPerUsd": 26.5897549175735,
      "usdPerUnit": 0.0376084699953019
    },
    {
      "currency": "PYG",
      "name": "Paraguayan Guarani",
      "unitsPerUsd": 6315.68007997275,
      "usdPerUnit": 0.000158336075820407
    },
    {
      "currency": "ETB",
      "name": "Ethiopian Birr",
      "unitsPerUsd": 156.524703523642,
      "usdPerUnit": 0.00638876789087132
    },
    {
      "currency": "NAD",
      "name": "Namibian Dollar",
      "unitsPerUsd": 16.7081937302619,
      "usdPerUnit": 0.0598508741366096
    },
    {
      "currency": "PGK",
      "name": "Papua New Guinean Kina",
      "unitsPerUsd": 4.35821829139335,
      "usdPerUnit": 0.229451563262631
    },
    {
      "currency": "SDG",
      "name": "Sudanese Pound",
      "unitsPerUsd": 600.123897378845,
      "usdPerUnit": 0.00166632257833372
    },
    {
      "currency": "MOP",
      "name": "Macau Pataca",
      "unitsPerUsd": 8.06827084370714,
      "usdPerUnit": 0.12394229437401
    },
    {
      "currency": "BMD",
      "name": "Bermudian Dollar",
      "unitsPerUsd": 1,
      "usdPerUnit": 1
    },
    {
      "currency": "NIO",
      "name": "Nicaraguan Cordoba",
      "unitsPerUsd": 36.7932328270782,
      "usdPerUnit": 0.0271789109888719
    },
    {
      "currency": "BAM",
      "name": "Bosnia-Herzegovina Convertible Mark",
      "unitsPerUsd": 1.66746202442022,
      "usdPerUnit": 0.599713807783838
    },
    {
      "currency": "KZT",
      "name": "Kazakhstani Tenge",
      "unitsPerUsd": 463.250031881713,
      "usdPerUnit": 0.00215866148122649
    },
    {
      "currency": "PAB",
      "name": "Panamanian Balboa",
      "unitsPerUsd": 1,
      "usdPerUnit": 1
    },
    {
      "currency": "GYD",
      "name": "Guyanese Dollar",
      "unitsPerUsd": 209.218387873567,
      "usdPerUnit": 0.00477969460602242
    },
    {
      "currency": "YER",
      "name": "Yemeni Rial",
      "unitsPerUsd": 238.608857146564,
      "usdPerUnit": 0.00419095926261343
    },
    {
      "currency": "MGA",
      "name": "Malagasy Ariary",
      "unitsPerUsd": 4159.734959075,
      "usdPerUnit": 0.000240399931687563
    },
    {
      "currency": "KYD",
      "name": "Caymanian Dollar",
      "unitsPerUsd": 0.831729407147226,
      "usdPerUnit": 1.20231410769751
    },
    {
      "currency": "MZN",
      "name": "Mozambican Metical",
      "unitsPerUsd": 63.7789947767129,
      "usdPerUnit": 0.0156791433214171
    },
    {
      "currency": "RSD",
      "name": "Serbian Dinar",
      "unitsPerUsd": 100.069026097613,
      "usdPerUnit": 0.00999310215155425
    },
    {
      "currency": "SCR",
      "name": "Seychellois Rupee",
      "unitsPerUsd": 14.2107140468442,
      "usdPerUnit": 0.0703694407405284
    },
    {
      "currency": "AMD",
      "name": "Armenian Dram",
      "unitsPerUsd": 371.180222211313,
      "usdPerUnit": 0.00269410906120611
    },
    {
      "currency": "AZN",
      "name": "Azerbaijan Manat",
      "unitsPerUsd": 1.70034468503974,
      "usdPerUnit": 0.588116050115231
    },
    {
      "currency": "SBD",
      "name": "Solomon Islander Dollar",
      "unitsPerUsd": 8.03387314629836,
      "usdPerUnit": 0.124472963636568
    },
    {
      "currency": "TOP",
      "name": "Tongan Pa’anga",
      "unitsPerUsd": 2.40177582572109,
      "usdPerUnit": 0.416358591543307
    },
    {
      "currency": "BZD",
      "name": "Belizean Dollar",
      "unitsPerUsd": 2.01446124509706,
      "usdPerUnit": 0.49641064201849
    },
    {
      "currency": "GMD",
      "name": "Gambian Dalasi",
      "unitsPerUsd": 73.6563036981397,
      "usdPerUnit": 0.0135765705009883
    },
    {
      "currency": "MWK",
      "name": "Malawian Kwacha",
      "unitsPerUsd": 1733.88368925859,
      "usdPerUnit": 0.000576739954470416
    },
    {
      "currency": "BIF",
      "name": "Burundian Franc",
      "unitsPerUsd": 3007.2963438164,
      "usdPerUnit": 0.000332524595408163
    },
    {
      "currency": "HTG",
      "name": "Haitian Gourde",
      "unitsPerUsd": 131.417052053109,
      "usdPerUnit": 0.00760936259318818
    },
    {
      "currency": "SOS",
      "name": "Somali Shilling",
      "unitsPerUsd": 571.250740915844,
      "usdPerUnit": 0.0017505447754812
    },
    {
      "currency": "GNF",
      "name": "Guinean Franc",
      "unitsPerUsd": 8776.82666942224,
      "usdPerUnit": 0.000113936396110443
    },
    {
      "currency": "MNT",
      "name": "Mongolian Tughrik",
      "unitsPerUsd": 3580.36974676498,
      "usdPerUnit": 0.000279300762415262
    },
    {
      "currency": "MVR",
      "name": "Maldivian Rufiyaa",
      "unitsPerUsd": 15.4545025952529,
      "usdPerUnit": 0.0647060617989195
    },
    {
      "currency": "CDF",
      "name": "Congolese Franc",
      "unitsPerUsd": 2327.59227956408,
      "usdPerUnit": 0.000429628508729751
    },
    {
      "currency": "STN",
      "name": "Sao Tomean Dobra",
      "unitsPerUsd": 21.086261637264,
      "usdPerUnit": 0.0474242431969439
    },
    {
      "currency": "TJS",
      "name": "Tajikistani Somoni",
      "unitsPerUsd": 9.38203386019802,
      "usdPerUnit": 0.106586696967952
    },
    {
      "currency": "KPW",
      "name": "North Korean Won",
      "unitsPerUsd": 900.000837991196,
      "usdPerUnit": 0.00111111007655504
    },
    {
      "currency": "KGS",
      "name": "Kyrgyzstani Som",
      "unitsPerUsd": 87.527735805501,
      "usdPerUnit": 0.0114249499406924
    },
    {
      "currency": "LRD",
      "name": "Liberian Dollar",
      "unitsPerUsd": 183.620868915019,
      "usdPerUnit": 0.00544600407300546
    },
    {
      "currency": "LSL",
      "name": "Basotho Loti",
      "unitsPerUsd": 16.7081937302619,
      "usdPerUnit": 0.0598508741366096
    },
    {
      "currency": "MMK",
      "name": "Burmese Kyat",
      "unitsPerUsd": 2099.99896730735,
      "usdPerUnit": 0.000476190710361259
    },
    {
      "currency": "GIP",
      "name": "Gibraltar Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "XPT",
      "name": "Platinum Ounce",
      "unitsPerUsd": 0.000509332569193484,
      "usdPerUnit": 1963.35373090999
    },
    {
      "currency": "MDL",
      "name": "Moldovan Leu",
      "unitsPerUsd": 17.2652192277647,
      "usdPerUnit": 0.0579199132549597
    },
    {
      "currency": "CUP",
      "name": "Cuban Peso",
      "unitsPerUsd": 24.0071128420457,
      "usdPerUnit": 0.0416543216412351
    },
    {
      "currency": "KHR",
      "name": "Cambodian Riel",
      "unitsPerUsd": 4010.18039636214,
      "usdPerUnit": 0.000249365340498685
    },
    {
      "currency": "MKD",
      "name": "Macedonian Denar",
      "unitsPerUsd": 52.6107316361538,
      "usdPerUnit": 0.0190075288615223
    },
    {
      "currency": "VUV",
      "name": "Ni-Vanuatu Vatu",
      "unitsPerUsd": 118.806319086519,
      "usdPerUnit": 0.00841706070593566
    },
    {
      "currency": "MRU",
      "name": "Mauritanian Ouguiya",
      "unitsPerUsd": 39.8321145795433,
      "usdPerUnit": 0.0251053706426515
    },
    {
      "currency": "SZL",
      "name": "Swazi Lilangeni",
      "unitsPerUsd": 16.7081937302619,
      "usdPerUnit": 0.0598508741366096
    },
    {
      "currency": "CVE",
      "name": "Cape Verdean Escudo",
      "unitsPerUsd": 94.0117686265258,
      "usdPerUnit": 0.0106369661438094
    },
    {
      "currency": "SRD",
      "name": "Surinamese Dollar",
      "unitsPerUsd": 37.4636381038735,
      "usdPerUnit": 0.0266925491119509
    },
    {
      "currency": "SVC",
      "name": "Salvadoran Colon",
      "unitsPerUsd": 8.75,
      "usdPerUnit": 0.114285714285714
    },
    {
      "currency": "XPD",
      "name": "Palladium Ounce",
      "unitsPerUsd": 0.000670871586363863,
      "usdPerUnit": 1490.59823120549
    },
    {
      "currency": "BSD",
      "name": "Bahamian Dollar",
      "unitsPerUsd": 1,
      "usdPerUnit": 1
    },
    {
      "currency": "XDR",
      "name": "IMF Special Drawing Rights",
      "unitsPerUsd": 0.729774029122637,
      "usdPerUnit": 1.37028718492796
    },
    {
      "currency": "RWF",
      "name": "Rwandan Franc",
      "unitsPerUsd": 1462.58190050496,
      "usdPerUnit": 0.000683722395070485
    },
    {
      "currency": "AWG",
      "name": "Aruban or Dutch Guilder",
      "unitsPerUsd": 1.79,
      "usdPerUnit": 0.558659217877094
    },
    {
      "currency": "BTN",
      "name": "Bhutanese Ngultrum",
      "unitsPerUsd": 94.9136962646106,
      "usdPerUnit": 0.0105358872255073
    },
    {
      "currency": "DJF",
      "name": "Djiboutian Franc",
      "unitsPerUsd": 178.074972646567,
      "usdPerUnit": 0.00561561226228427
    },
    {
      "currency": "KMF",
      "name": "Comorian Franc",
      "unitsPerUsd": 419.431924228824,
      "usdPerUnit": 0.00238417712680935
    },
    {
      "currency": "ERN",
      "name": "Eritrean Nakfa",
      "unitsPerUsd": 15,
      "usdPerUnit": 0.0666666666666666
    },
    {
      "currency": "FKP",
      "name": "Falkland Island Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "SHP",
      "name": "Saint Helenian Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "SPL",
      "name": "Seborgan Luigino",
      "unitsPerUsd": 0.166666666,
      "usdPerUnit": 6.000000024
    },
    {
      "currency": "WST",
      "name": "Samoan Tala",
      "unitsPerUsd": 2.73599118388627,
      "usdPerUnit": 0.365498253755179
    },
    {
      "currency": "JEP",
      "name": "Jersey Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "TMT",
      "name": "Turkmenistani Manat",
      "unitsPerUsd": 3.50690398828396,
      "usdPerUnit": 0.285151804366714
    },
    {
      "currency": "GGP",
      "name": "Guernsey Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "IMP",
      "name": "Isle of Man Pound",
      "unitsPerUsd": 0.73638185763046,
      "usdPerUnit": 1.35799108796326
    },
    {
      "currency": "TVD",
      "name": "Tuvaluan Dollar",
      "unitsPerUsd": 1.39199764522469,
      "usdPerUnit": 0.718392019864789
    },
    {
      "currency": "ZMW",
      "name": "Zambian Kwacha",
      "unitsPerUsd": 18.7518072546147,
      "usdPerUnit": 0.0533281931934269
    },
    {
      "currency": "ADA",
      "name": "Cardano",
      "unitsPerUsd": 4.03861722490531,
      "usdPerUnit": 0.24760950204273
    },
    {
      "currency": "ARB",
      "name": "ARB",
      "unitsPerUsd": 7.85204301651833,
      "usdPerUnit": 0.127355389915248
    },
    {
      "currency": "AVAX",
      "name": "AVAX",
      "unitsPerUsd": 0.109459396225872,
      "usdPerUnit": 9.13580774679656
    },
    {
      "currency": "BCH",
      "name": "Bitcoin Cash",
      "unitsPerUsd": 0.00225151560784074,
      "usdPerUnit": 444.145266645085
    },
    {
      "currency": "BNB",
      "name": "BNB",
      "unitsPerUsd": 0.00162073400093271,
      "usdPerUnit": 617.004393950215
    },
    {
      "currency": "BTC",
      "name": "Bitcoin",
      "unitsPerUsd": 0.0000130765693567882,
      "usdPerUnit": 76472.6567584704
    },
    {
      "currency": "CLF",
      "name": "CLF",
      "unitsPerUsd": 0.0227436850214176,
      "usdPerUnit": 43.9682487274294
    },
    {
      "currency": "CNH",
      "name": "Chinese Yuan Renminbi Offshore",
      "unitsPerUsd": 6.83259125951447,
      "usdPerUnit": 0.146357357262881
    },
    {
      "currency": "DAI",
      "name": "DAI",
      "unitsPerUsd": 1.00015002250337,
      "usdPerUnit": 0.99985
    },
    {
      "currency": "DOGE",
      "name": "Dogecoin",
      "unitsPerUsd": 9.33427137578374,
      "usdPerUnit": 0.107132089880559
    },
    {
      "currency": "DOT",
      "name": "Polkadot",
      "unitsPerUsd": 0.821372605562074,
      "usdPerUnit": 1.21747425374101
    },
    {
      "currency": "ETH",
      "name": "Ethereum",
      "unitsPerUsd": 0.000441237711861344,
      "usdPerUnit": 2266.3520662854
    },
    {
      "currency": "EURC",
      "name": "EURC",
      "unitsPerUsd": 0.853942275134946,
      "usdPerUnit": 1.1710393420234
    },
    {
      "currency": "LINK",
      "name": "Chainlink",
      "unitsPerUsd": 0.109404759523073,
      "usdPerUnit": 9.14037016633723
    },
    {
      "currency": "LTC",
      "name": "Litecoin",
      "unitsPerUsd": 0.0179748857082183,
      "usdPerUnit": 55.6331771023605
    },
    {
      "currency": "LUNA",
      "name": "Terra",
      "unitsPerUsd": 18.1969321991511,
      "usdPerUnit": 0.0549543180716279
    },
    {
      "currency": "MXV",
      "name": "MXV",
      "unitsPerUsd": 1.98342035609473,
      "usdPerUnit": 0.504179558774395
    },
    {
      "currency": "POL",
      "name": "POL",
      "unitsPerUsd": 10.459820005031,
      "usdPerUnit": 0.0956039396011605
    },
    {
      "currency": "SLE",
      "name": "Sierra Leonean Leone",
      "unitsPerUsd": 23.2840151478595,
      "usdPerUnit": 0.0429479191475241
    },
    {
      "currency": "SOL",
      "name": "SOL",
      "unitsPerUsd": 0.0119940004674127,
      "usdPerUnit": 83.3750175945853
    },
    {
      "currency": "SSP",
      "name": "SSP",
      "unitsPerUsd": 4634.81470925257,
      "usdPerUnit": 0.000215758355561373
    },
    {
      "currency": "TRX",
      "name": "TRX",
      "unitsPerUsd": 3.07344014999599,
      "usdPerUnit": 0.325368301055513
    },
    {
      "currency": "UNI",
      "name": "Uniswap",
      "unitsPerUsd": 0.310925194654425,
      "usdPerUnit": 3.21620768336718
    },
    {
      "currency": "USDC",
      "name": "USDC",
      "unitsPerUsd": 1.00011489184912,
      "usdPerUnit": 0.999885121349499
    },
    {
      "currency": "USDP",
      "name": "USDP",
      "unitsPerUsd": 1.00170288661098,
      "usdPerUnit": 0.998300008282151
    },
    {
      "currency": "USDT",
      "name": "USDT",
      "unitsPerUsd": 1.00033236095783,
      "usdPerUnit": 0.999667749469272
    },
    {
      "currency": "VED",
      "name": "VED",
      "unitsPerUsd": 485.883450604232,
      "usdPerUnit": 0.00205810673064996
    },
    {
      "currency": "XBT",
      "name": "XBT",
      "unitsPerUsd": 0.0000130765693567882,
      "usdPerUnit": 76472.6567584704
    },
    {
      "currency": "XCG",
      "name": "Caribbean Guilder",
      "unitsPerUsd": 1.80293536903418,
      "usdPerUnit": 0.554651052486528
    },
    {
      "currency": "XLM",
      "name": "Stellar Lumen",
      "unitsPerUsd": 6.26483572512218,
      "usdPerUnit": 0.159621104826415
    },
    {
      "currency": "XRP",
      "name": "Ripple",
      "unitsPerUsd": 0.73013375091813,
      "usdPerUnit": 1.36961207277778
    },
    {
      "currency": "ZWG",
      "name": "Zimbabwean Dollar",
      "unitsPerUsd": 25.3895774052825,
      "usdPerUnit": 0.0393862404260395
    }
  ]
} satisfies BankBalanceWorkbookData;
