module.exports = function seed(callback) {
    var collection = require("./collection"),

        User = collection.models.User,
        Cart = collection.models.Cart,

        length = 0,
        done = false;

    console.time("seed");

    function createCallback(err) {
        length++;

        return function doneCallback(errs) {
            if (done === true) {
                return;
            }
            if (errs || --length <= 0) {
                done = true;
                callback(errs);
                console.timeEnd("seed");
            }
        }
    }

    User.create({
        firstName: "Bob",
        lastName: "Smile",
        age: 64,
        password: "bobsmile",
        email: "bobsmile@bob.com"
    }, createCallback());

    User.create({
        firstName: "Nathan",
        lastName: "Faucett",
        age: 21,
        password: "nathanfaucett",
        email: "nathanfaucett@gmail.com"
    }, createCallback());

    User.create({
        firstName: "Sue",
        lastName: "Frank",
        age: 36,
        password: "suefrank",
        email: "suefrank@yahoo.com"
    }, createCallback());


    Cart.create({
        userId: 1,
        title: "Fun cart",
        content: "nothing like this"
    }, createCallback());

    Cart.create({
        userId: 1,
        title: "Other Fun cart",
        content: "there is something like this"
    }, createCallback());


    Cart.create({
        userId: 2,
        title: "My cart",
        content: "its alright"
    }, createCallback());

    Cart.create({
        userId: 2,
        title: "This Cart is Great!",
        content: "Maybe?"
    }, createCallback());


    Cart.create({
        userId: 3,
        title: "Cart",
        content: "big stuff"
    }, createCallback());

    Cart.create({
        userId: 3,
        title: "Cart of Great",
        content: "has many good times"
    }, createCallback());
};