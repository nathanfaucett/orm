var EventEmitter = require("event_emitter"),
    forEach = require("for_each"),
    isString = require("is_string"),
    isFunction = require("is_function"),
    isObject = require("is_object"),
    isArray = require("is_array"),
    tableize = require("tableize"),
    underscore = require("underscore"),
    PromisePolyfill = require("promise_polyfill"),
    validator = require("validator"),

    Query = require("./query"),
    Table = require("./table"),
    hooks = require("./hooks");


var slice = Array.prototype.slice;


function Model(opts) {
    var options = {};

    opts || (opts = {});

    if (!isString(opts.name) && !isString(opts.className)) {
        throw new Error(
            "Model(options)\n" +
            "    options.name or options.className required as string ex {name: 'User'}"
        );
    }

    options.columns = opts.columns || opts.schema;
    options.functions = opts.functions;

    options.className = opts.name || opts.className;
    options.tableName = isString(opts.tableName) ? opts.tableName : tableize(options.className);

    options.autoId = (opts.autoId != null) ? opts.autoId : true;
    options.timestamps = (opts.timestamps != null) ? opts.timestamps : true;

    EventEmitter.call(this);

    this._options = options;

    this._init = false;
    this._collection = null;

    this._accessible = {};
    this._validations = {};
    this._wrappers = {};

    this._schema = new Table(options.tableName, options);

    this.Class = null;

    this.adapter = opts.adapter;

    this.className = options.className;
    this.tableName = options.tableName;

    this.prototype = {};
}
EventEmitter.extend(Model);

Model.prototype.init = function(callback) {
    var _this = this,
        adapter = this.adapter || this._collection._options.defaultAdapter,
        schema = this._schema;

    forEach(schema._functions, function(options, name) {
        var hookFunc = hooks[name],
            hook;

        if (!isFunction(hookFunc)) {
            return;
        }

        hook = hookFunc(isObject(options) ? options : {});

        forEach(hook.events, function(event, eventType) {
            if (isArray(event)) {
                forEach(event, function(e) {
                    _this.on(eventType, e);
                });
            } else if (isFunction(event)) {
                _this.on(eventType, event);
            }
        });
    });

    forEach(schema.columns, function(column, name) {

        _this.validates(name)[column.type]();
    });

    if (isString(adapter)) {
        this.adapter = this._collection.adapter(adapter);
    } else {
        this.adapter = adapter;
    }

    this.generateClass();
    this._wrappers = {};

    this.emitAsync("init", callback);

    return this;
};

Model.prototype.build = function(attributes) {
    var instance = new this.Class(),
        schema, columns, columnType, keys, key, attribute, i;

    if (isObject(attributes)) {
        schema = this._schema;
        columns = schema.columns;
        keys = schema._keys;
        i = keys.length;

        while (i--) {
            key = keys[i];
            attribute = attributes[key];
            columnType = columns[key].type;

            if (attribute != null) {
                if (columnType === "datetime") {
                    instance[key] = (new Date(attribute)).toJSON();
                } else if (columnType === "json" && isString(attribute)) {
                    try {
                        instance[key] = JSON.parse(attribute);
                    } catch (e) {
                        instance[key] = null;
                    }
                } else {
                    instance[key] = attribute;
                }
            }
        }
    }

    return instance;
};

Model.prototype["new"] = Model.prototype.build;

Model.prototype.create = function(attributes, callback) {
    var _this = this,
        isPromise = !isFunction(callback),
        model = this.build(attributes),
        defer;

    if (isPromise) {
        defer = PromisePolyfill.defer();
    }

    function resolve(row) {
        return isPromise ? defer.resolve(row) : callback(undefined, row);
    }

    function reject(err) {
        return isPromise ? defer.reject(err) : callback(err);
    }

    function beforeValidate(err) {
        var errors;

        if (err) {
            reject(err);
            return;
        }
        if ((errors = _this.validate(model))) {
            reject(errors);
            return;
        }

        _this.emitAsync("validate", model, validate);
    }

    function validate(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.emitAsync("beforeCreate", model, beforeCreate);
    }

    function beforeCreate(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.adapter.save(_this.tableName, model, function(err, row) {
            if (err) {
                reject(err);
                return;
            }

            row = _this.build(row);
            _this.emitAsync("create", row, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    this._schema.coerce(model);
    this.emitAsync("beforeValidate", model, beforeValidate);

    return defer ? defer.promise : undefined;
};

Model.prototype.save = function(model, callback) {
    var _this = this,
        isPromise = !isFunction(callback),
        defer;

    if (isPromise) {
        defer = PromisePolyfill.defer();
    }

    function resolve(row) {
        return isPromise ? defer.resolve(row) : callback(undefined, row);
    }

    function reject(err) {
        return isPromise ? defer.reject(err) : callback(err);
    }

    function beforeValidate(err) {
        var errors;

        if (err) {
            reject(err);
            return;
        }
        if ((errors = _this.validate(model))) {
            reject(errors);
            return;
        }

        _this.emitAsync("validate", model, validate);
    }

    function validate(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.emitAsync("beforeSave", model, beforeSave);
    }

    function beforeSave(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.adapter.save(_this.tableName, model, function(err, row) {
            if (err) {
                reject(err);
                return;
            }

            row = _this.build(row);
            _this.emitAsync("save", row, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    this._schema.coerce(model);
    this.emitAsync("beforeValidate", model, beforeValidate);

    return defer ? defer.promise : undefined;
};

Model.prototype.update = function(id, model, callback) {
    var _this = this,
        isPromise = !isFunction(callback),
        defer;

    if (isPromise) {
        defer = PromisePolyfill.defer();
    }

    function resolve(row) {
        return isPromise ? defer.resolve(row) : callback(undefined, row);
    }

    function reject(err) {
        return isPromise ? defer.reject(err) : callback(err);
    }

    function beforeValidate(err) {
        var errors;

        if (err) {
            reject(err);
            return;
        }
        if ((errors = _this.validate(model))) {
            reject(errors);
            return;
        }

        _this.emitAsync("validate", model, validate);
    }

    function validate(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.emitAsync("beforeUpdate", model, beforeUpdate);
    }

    function beforeUpdate(err) {
        if (err) {
            reject(err);
            return;
        }
        _this.adapter.update(_this.tableName, id, model, function(err, row) {
            if (err) {
                reject(err);
                return;
            }

            row = _this.build(row);
            _this.emitAsync("update", row, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    model = this._schema.filter(model, this._accessible);
    this.emitAsync("beforeValidate", model, beforeValidate);

    return defer ? defer.promise : undefined;
};

Model.prototype.find = function(query, callback) {
    var _this = this;

    if (isFunction(query)) {
        callback = query;
        query = {};
    }

    if (isFunction(callback)) {
        if (!isObject(query)) {
            query = {};
        }

        if (query.where === undefined || query.where === null) {
            query.where = {};
        }

        this.adapter.find(this.tableName, query, function(err, rows) {
            if (err) {
                callback(err);
                return;
            }

            callback(undefined, Model_toModels(_this, rows));
        });
        return undefined;
    }

    return new Query(this, "find", query);
};

Model.prototype.findOne = function(query, callback) {
    var _this = this;

    if (isFunction(query)) {
        callback = query;
        query = {};
    }

    if (isFunction(callback)) {
        if (!isObject(query)) {
            query = {};
        }

        if (query.where === undefined || query.where === null) {
            query.where = {};
        }

        this.adapter.findOne(this.tableName, query, function(err, row) {
            if (err) {
                callback(err);
                return;
            }

            callback(undefined, _this.build(row));
        });
        return undefined;
    }

    return new Query(this, "findOne", query);
};

Model.prototype.destroy = function(query, callback) {
    var _this = this,
        beforeDestroy;

    if (isFunction(query)) {
        callback = query;
        query = {};
    }

    if (isFunction(callback)) {
        beforeDestroy = function beforeDestroy(err) {
            if (err) {
                callback(err);
                return;
            }

            if (!isObject(query)) {
                query = {};
            }

            if (query.where === undefined || query.where === null) {
                query.where = {};
            }

            _this.adapter.destroy(_this.tableName, query, function(err, rows) {
                if (err) {
                    callback(err);
                    return;
                }

                rows = Model_toModels(_this, rows);
                _this.emitAsync("destroy", rows, function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(undefined, rows);
                });
            });
        };

        this.emitAsync("beforeDestroy", query, beforeDestroy);
        return undefined;
    }

    return new Query(this, "destroy", query);
};

Model.prototype.accessible = function() {
    var accessible = this._accessible,
        i = arguments.length,
        columnName;

    while (i--) {
        if ((columnName = arguments[i])) {
            accessible[columnName] = true;
        }
    }
    return this;
};

Model.prototype.validates = function(columnName) {
    var validations = this._validations,
        wrappers = this._wrappers,
        validation = validations[columnName] || (validations[columnName] = {}),
        wrapper = wrappers[columnName];

    if (!wrapper) {
        wrapper = wrappers[columnName] = {};

        forEach(validator.rules, function(rule, ruleName) {
            wrapper[ruleName] = function() {
                validation[underscore(ruleName)] = arguments.length > 0 ? slice.call(arguments) : true;
                return wrapper;
            };
        });
    }

    return wrapper;
};

function ValidationError(tableName, columnName, value, rule, args) {

    this.tableName = tableName;
    this.columnName = columnName;
    this.value = value;
    this.rule = rule;
    this.args = args;
}

Model.prototype.validate = function(values, method) {
    var match = validator.match,
        validations = this._validations,
        keys = this._schema._keys,
        i = keys.length,
        key, validation, value, rule, args, error, errors;

    while (i--) {
        key = keys[i];
        value = values[key];
        validation = validations[key];

        if (
            (value === undefined || value === null) &&
            (!validation || !validation.required || method === "update")
        ) {
            continue;
        }

        for (rule in validation) {
            args = validation[rule];

            if (typeof(args) === "boolean") {
                error = match(rule, value);
            } else {
                error = match(rule, value, args);
            }

            if (error) {
                (errors || (errors = [])).push(new ValidationError(this.tableName, key, value, rule, args));
            }
        }
    }

    return errors;
};

Model.prototype.generateClass = function() {
    var model = this,
        Class;

    try {
        eval([
            "function " + this.className + "() {",
            Model_generateClassAttributes(this),
            "}",
            "Class = " + this.className + ";"
        ].join("\n"));
    } catch (e) {
        throw new Error("Model.generateClass() failed to generate model for " + this.className + " with error " + e.message);
    }

    Class.prototype = model.prototype;
    Class.prototype.constructor = Class;

    Class.prototype.save = function(callback) {

        return model.save(this, callback);
    };

    Class.prototype.update = function(callback) {

        return model.update(this.id, this, callback);
    };

    Class.prototype.destroy = function(callback) {
        return model.destroy({
            where: {
                id: this.id
            }
        }, callback);
    };

    this.Class = Class;

    return this;
};

function Model_toModels(_this, array) {
    var i = array.length;

    while (i--) {
        array[i] = _this.build(array[i]);
    }
    return array;
}

function Model_generateClassAttributes(_this) {
    var out = [];

    forEach(_this._schema.columns, function(_, key) {
        out.push("\tthis." + key + " = null;");
    });

    return out.join("\n");
}


module.exports = Model;
