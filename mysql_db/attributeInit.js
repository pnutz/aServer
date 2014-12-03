module.exports.attrData = [
  {
    attribute: "date",
    datatype: "datetime"
  },
  {
    attribute: "vendor",
    datatype: "string"
  },
  {
    attribute: "transaction",
    datatype: "string"
  },
  {
    attribute: "total",
    datatype: "decimal"
  },
  /*{
    attribute: "shipping",
    datatype: "decimal"
  },*/
  {
    attribute: "currency",
    datatype: "string"
  }
];

module.exports.groupData = [
  {
    groupname: "items",
    attributes: [
      {
        attribute: "row",
        datatype: "null"
      },
      {
        attribute: "itemtype",
        datatype: "string"
      },
      {
        attribute: "item_cost",
        datatype: "decimal"
      },
      {
        attribute: "quantity",
        datatype: "integer"
      }
    ]
  },
  {
    groupname: "taxes",
    attributes: [
      {
        attribute: "row",
        datatype: "null"
      },
      {
        attribute: "taxtype",
        datatype: "string"
      },
      {
        attribute: "tax_cost",
        datatype: "decimal"
      }
    ]
  }
];
