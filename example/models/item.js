var orm = require("../../src/index.js");


var Item = new orm.define({
    name: "Item",

    schema: {
        title: "string",
        content: "string",
        json: "json",
        belongsTo: ["user", "cart"]
    }
});

Item.accessible(
    "title",
    "content",
    "json"
);


module.exports = Item;
