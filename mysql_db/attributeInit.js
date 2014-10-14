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
  {
    attribute: "shipping",
    datatype: "decimal"
  },
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
        attribute: "cost",
        datatype: "decimal"
      },
      {
        attribute: "quantity",
        datatype: "integer"
      }
    ]
  }
];
