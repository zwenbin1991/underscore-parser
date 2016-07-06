//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

// 使用iife形式，提供命名空间，避免冲突其他同名的变量
(function () {
    // Baseline setup
    // 基本设置
    // --------------

    // Establish the root object, `window` (`self`) in the browser, `global`
    // on the server, or `this` in some virtual machines. We use `self`
    // instead of `window` for `WebWorker` support.
    // --------------
    // 获取全局对象，在浏览器环境下全局对象是'self'
    // node环境下全局对象是'global'
    // 严格模式下 'undefined'
    var root = typeof self === 'object' && self.self === self && self ||
        typeof global === 'object' && global.global === global && global ||
        this;

    // Save the previous value of the `_` variable.
    // --------------
    // 定义一个指代原来全局对象的'_'变量
    // 可利用后续_.noConflict进行恢复
    var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    // --------------
    // 获取'Array'、'Object'、'SymbolProto'(es6)的prototype
    var ArrayProto = Array.prototype, ObjProto = Object.prototype;
    var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

    // Create quick reference variables for speed access to core prototypes.
    // --------------
    // 定义一些快捷方法，目的是为了提高变量访问速度
    // 避免直接在prototype查找
    var push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    // --------------
    // 保存**ECMAScript 5**支持的快捷方法
    // underscore.js会优雅降级这些方法，如果浏览器支持，则优先使用
    var nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeCreate = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor = function(){};

    // Create a safe reference to the Underscore object for use below.
    // --------------
    // 创建underscore构造函数
    var _ = function(obj) {
        // 如果传入的对象是当前underscore的实例，直接返回，参考zepto实例
        if (obj instanceof _) return obj;
        // 如果构造器当做普通函数调用，直接内部实例化对象
        if (!(this instanceof _)) return new _(obj);
        // 创建_wrapped属性,属性值为obj
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for their old module API. If we're in
    // the browser, add `_` as a global object.
    // (`nodeType` is checked to ensure that `module`
    // and `exports` are not HTML elements.)
    // --------------
    // 设置导出对象
    // 在浏览器端设置全局对象的'_'属性
    // 在node.js设置exports的'_'属性
    if (typeof exports != 'undefined' && !exports.nodeType) {
        if (typeof module != 'undefined' && !module.nodeType && module.exports) {
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        root._ = _;
    }


    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    // --------------
    // 根据argCount创建更加参数详细的闭包
    // 在闭包中将func的上下文指定为context，并且将参数传入func
    var optimizeCb = function(func, context, argCount) {
        // 如果不存在上下文，直接返回func
        if (context === void 0) return func;

        // 根据argCount创建带有几个参数的闭包，每个闭包都处理适合的业务, argCount默认为3
        switch (argCount == null ? 3 : argCount) {
            // 数组或对象each，只需要获取数组或对象值的业务
            case 1: return function(value) {
                return func.call(context, value);
            };
            // The 2-parameter case has been omitted only because no current consumers
            // made use of it.

            // 数组map|each，需要得到值、key、集合的业务
            case 3: return function(value, index, collection) {
                return func.call(context, value, index, collection);
            };

            // 数组reduce，需要得到accumulator(初始值)，当前值、key、集合的业务
            case 4: return function(accumulator, value, index, collection) {
                return func.call(context, accumulator, value, index, collection);
            };
        }
        return function() {
            return func.apply(context, arguments);
        };
    };


    var builtinIteratee;

    // An internal function to generate callbacks that can be applied to each
    // element in a collection, returning the desired result — either `identity`,
    // an arbitrary callback, a property matcher, or a property accessor.
    // --------------
    // 根据value的类型，返回诸如 只需得到value的迭代函数，对象匹配函数，属性访问函数
    var cb = function(value, context, argCount) {
        // 如果_.iteratee外部进行修改，则统一返回_.iteratee的结果
        if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);

        // value不存在，返回只需得到value的迭代函数
        if (value == null) return _.identity;
        // value是函数，返回optimizeCb的结果
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        // value是对象，返回对象匹配函数
        if (_.isObject(value)) return _.matcher(value);
        // 返回属性访问函数
        return _.property(value);
    };

    // External wrapper for our callback generator. Users may customize
    // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
    // This abstraction hides the internal-only argCount argument.
    //
    _.iteratee = builtinIteratee = function(value, context) {
        return cb(value, context, Infinity);
    };

    // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
    // This accumulates the arguments passed into an array, after a given index.
    // --------------
    // 函数支持ES6的默认剩余参数
    var restArgs = function(func, startIndex) {
        // 得到使用剩余参数的起始位置
        startIndex = startIndex == null ? func.length - 1 : +startIndex;
        return function() {
            // 得到从起始位置到实际参数的个数的遍历次数
            // 结果是得到从起始位置到实际参数结束位置的参数数组
            var length = Math.max(arguments.length - startIndex, 0);
            var rest = Array(length);
            for (var index = 0; index < length; index++) {
                rest[index] = arguments[index + startIndex];
            }

            // 列举出常用的默认参数起始位置的，内部实际传值情况
            switch (startIndex) {
                // 0：func的第一个参数就是默认参数
                case 0: return func.call(this, rest);

                // 1：func的第一个参数对应实际参数的第一个，
                //    func第二个参数对应实际参数的第二个,
                //    func的第三个参数就是默认参数
                case 1: return func.call(this, arguments[0], rest);

                // 1：func的第一个参数对应实际参数的第一个，
                //    func第二个参数对应实际参数的第二个,
                //    func第三个参数对应实际参数的第二个,
                //    func的第四个参数就是默认参数
                case 2: return func.call(this, arguments[0], arguments[1], rest);
            }

            // 如果默认参数起始位置大于2，重新构建新数组，数组长度是起始位置 + 1
            var args = Array(startIndex + 1);
            // 存储除起始位置的前面的所有实际参数
            for (index = 0; index < startIndex; index++) {
                args[index] = arguments[index];
            }
            // 以数组形式存储起始位置到实际参数结尾的参数集合
            args[startIndex] = rest;
            return func.apply(this, args);
        };
    };

    // An internal function for creating a new object that inherits from another.
    // --------------
    // 创建一个通过原型继承prototype的对象的内部方法
    // 如果ES5存在Object.create就调用该方法创建，反之则通过内部函数Ctor的prototype指向prototype然后实例化
    // 最后将内部函数Ctor的prototype指向null
    var baseCreate = function(prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);
        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    // 根据属性，创建一个获取该属性值的闭包
    var property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Math.pow(2, 53) - 1 是 JavaScript 中能精确表示的最大数字
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

    // 创建一个返回length属性值的函数
    var getLength = property('length');

    // 判断collection是否是类数组结构
    // 根据collection的length是否为数字类型，并且是大于等于0小于等于最大精确整数的
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Collection Functions
    // --------------------
    // 扩展集合(数组或对象)方法列表

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    // --------------------
    // 和ES5的Array.prototype.forEach用法一致
    // 遍历数组或对象的每一个元素
    // 第一个参数是数组或对象
    // 第二个参数是遍历函数
    // 第三个是遍历函数绑定的上下文
    // iteratee有三个参数，依次是元素值、key、集合
    // 假定不会传入类似{length: 10}这样的对象
    _.each = _.forEach = function(obj, iteratee, context) {
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        if (isArrayLike(obj)) {
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    // Return the results of applying the iteratee to each element.
    // --------------------
    // 和ES5的Array.prototype.map用法一致
    // 遍历数组或对象的每一个元素
    // 将元素值传入iteratee
    // 将iteratee返回值存入新数组
    // 返回新数组
    _.map = _.collect = function(obj, iteratee, context) {
        // 创建一个参数依次为value, key, collection的函数
        iteratee = cb(iteratee, context);

        // 巧妙的使用for ()形式遍历数组或对象
        // 如果是对象，获取对象的属性数组
        var keys = !isArrayLike(obj) && _.keys(obj),
        // 如果是对象，获取对象的数组数组的长度，反之，获取数组的长度
            length = (keys || obj).length,
        // 创建指定长度的新数组
            results = Array(length);
        for (var index = 0; index < length; index++) {
            // 如果是对象，当前key从对象的属性数组根据当前索引得到
            var currentKey = keys ? keys[index] : index;
            // 新数组存储iteartee结果
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        // 返回新数组
        return results;
    };

    // Create a reducing function iterating left or right.
    // --------------------
    // 根据dir，创建reduce
    // dir > 0 _.reduce
    // dir < 0 _.reduceRight
    var createReduce = function(dir) {
        // Wrap code that reassigns argument variables in a separate function than
        // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
        // --------------------
        // 创建reduce
        // 遍历对象或数组的每一个元素，传入初始值作为iteratee的第一个参数
        // 将当前iteratee的结果插入下一个iteratee第一个参数
        // 返回最终的结果
        var reducer = function(obj, iteratee, memo, initial) {
            // 巧妙的使用for ()遍历数组或对象
            // 如果obj是对象，得到对象的属性数组
            var keys = !isArrayLike(obj) && _.keys(obj),
            // 如果obj是对象，获取对象数组的属性数组的长度
                length = (keys || obj).length,
            // 得到根据dir的不同遍历起始值
            // 如果dir > 0，遍历起始值为0
            // 如果dir < 0，遍历起始值为length - 1
                index = dir > 0 ? 0 : length - 1;

            // 如果没传入初始值
            // dir > 0 初始值为数组或对象的第一个元素
            // dir < 0 初始值为数组或对象的最后一个元素
            // 得到遍历起始值的最终值
            if (!initial) {
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }

            // 如果dir > 0，遍历起始值结束条件为 >= length
            // 如果dir < 0，遍历起始值结束条件为 < 0
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }

            // 返回最终的结果
            return memo;
        };

        return function(obj, iteratee, memo, context) {
            // 如果传入的实参大于等于3，则传入了初始值，否则没有传入初始值
            var initial = arguments.length >= 3;
            return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
        };
    };

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    // --------------------
    // 和ES5的Array.prototype.reduce使用方法一致
    _.reduce = _.foldl = _.inject = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    // --------------------
    // 和ES5的Array.prototype.reduceRight使用方法一致
    _.reduceRight = _.foldr = createReduce(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    // --------------------
    // 查找对象或数组第一个满足条件(predicate返回true)的元素
    _.find = _.detect = function(obj, predicate, context) {
        var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
        var key = keyFinder(obj, predicate, context);
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    // --------------------
    // 和ES5的Array.prototype.filter一致
    // 存储数组或对象满足条件的元素
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        predicate = cb(predicate, context);
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });
        return results;
    };

    // Return all the elements for which a truth test fails.
    // --------------------
    // 存储数组或对象不满足条件的元素
    _.reject = function(obj, predicate, context) {
        return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // Returns a negated version of the passed-in predicate.
    // --------------------
    // 返回predicate相反的结果
    _.negate = function(predicate) {
        return function() {
            return !predicate.apply(this, arguments);
        };
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    // --------------------
    // 如果对象或数组存在一个不满足条件的元素，则返回false
    _.every = _.all = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    // --------------------
    // 如果对象或数组存在一个满足条件的元素，则返回true
    _.some = _.any = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    // --------------------
    // 判断数组或者对象是否包含给定的元素
    // 如果obj是对象，则从属性值数组查找
    _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
        if (!isArrayLike(obj)) obj = _.values(obj);
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;
        return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    // --------------------
    // 调用函数
    // 如果method是函数，改变method的上下文为数组或对象的元素,传入从第三个实参开始到结束的所有实参，返回的新数组存储调用结果
    // 如果method是字符串，传入从第三个实参开始到结束的所有实参
    _.invoke = restArgs(function(obj, method, args) {
        // 判断method是否是函数
        var isFunc = _.isFunction(method);
        // 数组或对象进行遍历
        return _.map(obj, function(value) {
            // 如果method是函数，直接得到，否则通过method作为元素的key
            var func = isFunc ? method : value[method];
            // 改变func的上下文，并将args所有参数传入func
            // 返回结果
            return func == null ? func : func.apply(value, args);
        });
    });

    // Convenience version of a common use case of `map`: fetching a property.
    // --------------------
    // 获取对象或数组的属性数组
    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    // --------------------
    // 通过浅拷贝attrs方式，存储数组或对象里的元素是否匹配attrs(键值对)的元素
    _.where = function(obj, attrs) {
        return _.filter(obj, _.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    // --------------------
    // 通过浅拷贝attrs方式，返回第一个匹配到的元素
    _.findWhere = function(obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    // --------------------
    // 查找数组中的最大值
    _.max = function(obj, iteratee, context) {
        var result = -Infinity, lastComputed = -Infinity,
            value, computed;
        // 如果obj是数组或数组，并且iteratee不存在
        if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
            // 如果obj是对象，获取属性值数组
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                // 过滤值为null或undefined
                // result初始值为最小的负数
                // 如果当前元素值大于result，重新将result赋予当前元素值
                if (value != null && value > result) {
                    result = value;
                }
            }
        } else {
            // 如果iteratee为函数
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                // 获取iteratee的值
                computed = iteratee(v, index, list);
                // lastComputed初始值为最小的负数
                // 如果传入元素值的iteratee结果大于lastComputed或当前记过===-Infinity，重新将lastComputed赋予当前iteratee的结果
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Return the minimum element (or element-based computation).
    // --------------------
    // 查找数组中的最小值
    _.min = function(obj, iteratee, context) {
        var result = Infinity, lastComputed = Infinity,
            value, computed;
        if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
            obj = isArrayLike(obj) ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value != null && value < result) {
                    result = value;
                }
            }
        } else {
            iteratee = cb(iteratee, context);
            _.each(obj, function(v, index, list) {
                computed = iteratee(v, index, list);
                if (computed < lastComputed || computed === Infinity && result === Infinity) {
                    result = v;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };

    // Shuffle a collection.
    // --------------------
    // 打乱数组或对象的元素
    _.shuffle = function(obj) {
        return _.sample(obj, Infinity);
    };

    // Sample **n** random values from a collection using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    // --------------------
    // 如果n不存在，随机返回对象或数组的一个元素
    // 如果n存在，返回n个随机位置代表的元素的数组
    _.sample = function(obj, n, guard) {
        // 随机返回一个元素
        if (n == null || guard) {
            if (!isArrayLike(obj)) obj = _.values(obj);
            return obj[_.random(obj.length - 1)];
        }

        // 返回n个随机元素的数组
        // 如果obj是数组，复制一个新数组
        // 如果obj是对象，得到对象的属性值数组
        var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
        // 得到对象或数组的长度
        var length = getLength(sample);
        // 确保需要返回的个数是0或正整数
        n = Math.max(Math.min(n, length), 0);
        // 获取最后一个元素的位置
        var last = length - 1;
        for (var index = 0; index < n; index++) {
            // 获取从index到n的随机位置
            var rand = _.random(index, last);
            // 元素交换位置
            var temp = sample[index];
            sample[index] = sample[rand];
            sample[rand] = temp;
        }
        return sample.slice(0, n);
    };

    // Sort the object's values by a criterion produced by an iteratee.
    // 数组或对象排序
    // 根据将value、key、collection传入到iteratee返回的值进行排序
    _.sortBy = function(obj, iteratee, context) {
        var index = 0;
        iteratee = cb(iteratee, context);
        return _.pluck(_.map(obj, function(value, key, list) {
            return {
                value: value,
                index: index++, // 如果当前迭代次数的iteratee返回的值和下一个迭代次数的iteratee返回值相同，通过index属性进行排序
                criteria: iteratee(value, key, list) // 当前迭代次数的iteratee返回值
            };
        }).sort(function(left, right) {
            var a = left.criteria; // 上一个元素的cirteria值
            var b = right.criteria; // 下一个元素的cirteria值
            // 如果值不同
            if (a !== b) {
                // 如果a > b a在b的后面
                if (a > b || a === void 0) return 1;
                // 如果a < b a在b的前面
                if (a < b || b === void 0) return -1;
            }

            // 如果值相同，更加元素的index值
            // 如果left.index - right.index > 0，a在b的后面
            // 如果left.index - right.index < 0，a在b的前面
            return left.index - right.index;
        }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    // --------------------
    // 数组分组
    var group = function(behavior, partition) {
        return function(obj, iteratee, context) {
            // 表示分组存储的集合
            var result = partition ? [[], []] : {};
            // 传入的iteratee，作用是得到分组的key
            iteratee = cb(iteratee, context);
            _.each(obj, function(value, index) {
                // 取到分组的key
                var key = iteratee(value, index, obj);
                // 根据key，进行分组
                behavior(result, value, key);
            });
            // 返回分组后的集合
            return result;
        };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    // --------------------
    // 根据key，进行分组
    // 如果key不同，创建key，赋予一个初始值为value的数组
    // 如果key相同，在当前key代表的数组push value
    _.groupBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key].push(value); else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    // --------------------
    // 和_.groupBy差不多，区别在于key如果是唯一的，那么用这个key作为分组的
    _.indexBy = group(function(result, value, key) {
        result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    // --------------------
    // 统计符合规则(key)的个数
    _.countBy = group(function(result, value, key) {
        if (_.has(result, key)) result[key]++; else result[key] = 1;
    });

    var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
    // Safely create a real, live array from anything iterable.
    // --------------------
    // 转换成数组
    _.toArray = function(obj) {
        if (!obj) return [];
        // 如果obj是数组，则拷贝一个完全匹配value，内存指针不同的新数组
        if (_.isArray(obj)) return slice.call(obj);
        if (_.isString(obj)) {
            // Keep surrogate pair characters together
            return obj.match(reStrSymbol);
        }
        // 如果是具有length属性的类数组对象，则重新拷贝一个完全匹配value，内存指针不同的新数组
        // 是否用slice.call更方便？
        if (isArrayLike(obj)) return _.map(obj, _.identity);
        // 如果是纯对象，则得到属性值数组
        return _.values(obj);
    };

    // Return the number of elements in an object.
    // --------------------
    // 获得数组、类数组对象、纯对象的属性名数组的长度
    _.size = function(obj) {
        if (obj == null) return 0;
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    // --------------------
    // 按照pass(是否满足条件)进行对象或数组分组（二维数组）
    // 二维数组第一个元素添加所有满足条件的value
    // 二维数组第二个元素添加所有不满足条件的value
    _.partition = group(function(result, value, pass) {
        result[pass ? 0 : 1].push(value);
    }, true);

    // Array Functions
    // ---------------
    // 数组扩展方法列表


    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    // ---------------
    // 返回数组第一个元素
    // 如果有n，返回数组前n个元素
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null || array.length < 1) return void 0;
        if (n == null || guard) return array[0];
        return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    // ---------------
    // 返回去除最后n个元素的全部元素
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    // ---------------
    // 返回数组最后一个元素
    // 如果有n，返回数组后n个元素
    _.last = function(array, n, guard) {
        if (array == null || array.length < 1) return void 0;
        if (n == null || guard) return array[array.length - 1];
        return _.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    // ---------------
    // 返回去除前n个元素的全部元素
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    // ---------------
    // 范围一个元素不为假值的数组副本
    // 在JavaScript中，假值包括 false, 0, '', null, undefined, NaN
    _.compact = function(array) {
        return _.filter(array, Boolean);
    };

    // Internal implementation of a recursive `flatten` function.
    // ---------------
    // 按条件展开数组
    // input：源数组
    // shallow：是否浅查找
    // strict：是否过滤非数组元素
    // input = [['xx', 'oo'], [['hao'], ['wu'], ['a']], true]
    // shallow == true, strict == true  => ['xx', 'oo', ['hao', 'wu', 'a']] 备注：浅查找，过滤掉非数组元素
    // shallow == true, strict == false  => ['xx', 'oo', ['hao', 'wu', 'a'], true] 备注：浅查找，不过滤掉非数组元素
    // shallow == false, strict == true => [] 备注：深查找，过滤掉非数组元素
    // shallow == false, strict == false => ['xx', 'oo', 'hao', 'wu', 'a', true] 备注：深查找，不过滤掉非数组严肃
    var flatten = function(input, shallow, strict, output) {
        output = output || [];
        var idx = output.length;
        // 遍历input
        for (var i = 0, length = getLength(input); i < length; i++) {
            var value = input[i];
            // 如果数组元素是数组或者arguments对象
            if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
                // Flatten current level of array or arguments object.
                // ---------------
                // 如果是浅查找，展开value每个元素
                if (shallow) {
                    var j = 0, len = value.length;
                    while (j < len) output[idx++] = value[j++];
                } else {
                // 如果是深查找，重新迭代value每个元素
                    flatten(value, shallow, strict, output);
                // 重新设置idx（当前output开始索引），其实这个表达式可以省略的，js中数组是自扩展的，只需把[idx++]格式换成push就可以
                    idx = output.length;
                }
            } else if (!strict) {
                // 如果当前元素是非数组元素，output追加该当前元素
                output[idx++] = value;
            }
        }
        return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    // ---------------
    // 根据浅查找或深查找并不过滤非数组元素进行展开数组
    // array = [['xx', 'oo'], [['hao'], ['wu'], ['a']], true]
    // shallow == true => ['xx', 'oo', ['hao', 'wu', 'a'], true]
    // shallow == false => ['xx', 'oo', 'hao', 'wu', 'a', true]
    _.flatten = function(array, shallow) {
        return flatten(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    // ---------------
    // 将传入_.without里的除第一个参数外的所有参数通过restArgs转成默认数组otherArrays
    // otherArrays 就是一个[xx, oo]
    // 返回array不存在otherArrays的元素
    _.without = restArgs(function(array, otherArrays) {
        return _.difference(array, otherArrays);
    });

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    // ---------------
    // rest是默认参数数组，首先通过浅查找、过滤非数组元素进行展开
    // 这里rest是二维数组，展开后得到一维数组
    // 通过_.filter存储array的不存在rest的元素
    _.difference = restArgs(function(array, rest) {
        rest = flatten(rest, true, true);
        return _.filter(array, function(value){
            return !_.contains(rest, value);
        });
    });

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    // ---------------
    // 数组去重
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
        // 如果isSorted不是boolean类型
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }
        // 如果iteratee是函数，进行二次封装
        // 如果存在context，则iteratee最终指向一个标准的迭代函数 function (value, idx, collection) {}
        if (iteratee != null) iteratee = cb(iteratee, context);
        var result = [];
        var seen = [];

        for (var i = 0, length = getLength(array); i < length; i++) {
            // 如果存在iteratee，当前元素遍历得到的值就是iteratee的结果
            // 这里采取了一个优化算法，就是如果是排好序的数组,当前元素和上一个元素进行比较即可，因为经过排序后，如果相同的元素会在一起
            var value = array[i],
                computed = iteratee ? iteratee(value, i, array) : value;
            if (isSorted) {
                // 比较当前元素和上一个元素是否相同，如果当前元素是起始元素或者当前元素和上一个元素不同
                if (!i || seen !== computed) result.push(value);
                // 当遍历完当前元素，设置上一个元素为当前元素，便于下次迭代
                seen = computed;
            } else if (iteratee) {
                // 如果没有排序并且存在iteratee，将iteratee的结果是否存在seen，如果不存在则存储iteratee的结果
                if (!_.contains(seen, computed)) {
                    seen.push(computed);
                    result.push(value);
                }
            } else if (!_.contains(result, value)) {
                result.push(value);
            }
        }
        return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = restArgs(function(arrays) {
        return _.uniq(flatten(arrays, true, true));
    });

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    // ---------------
    // 查找array的元素是否都存在于除了array以后的所有数组中，并且array的元素是去重的
    _.intersection = function(array) {
        // 得到去重和都存在后续数组中的元素
        var result = [];
        var argsLength = arguments.length;
        for (var i = 0, length = getLength(array); i < length; i++) {
            var item = array[i];
            // 如果存在相同，跳出当前循环，保证当前元素在result是唯一的
            if (_.contains(result, item)) continue;
            var j;
            // 如果在后续的数组都存在当前元素，则result存储当前元素
            for (j = 1; j < argsLength; j++) {
                if (!_.contains(arguments[j], item)) break;
            }
            if (j === argsLength) result.push(item);
        }
        return result;
    };

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices.
    // ---------------
    // 将二维数组中的每个元素按索引进行统计
    // array: [['xx', 1], ['oo', 2]]
    // => [['xx', 'oo'], [1, 2]];
    _.unzip = function(array) {
        var length = array && _.max(array, getLength).length || 0;
        var result = Array(length);

        for (var index = 0; index < length; index++) {
            result[index] = _.pluck(array, index);
        }
        return result;
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    // ---------------
    // 因为_.unzip接收的是二维数组，通过restArgs支持默认参数数组形式，可以传入多个数组
    // _.zip(['xx', 1], ['oo', 2])
    _.zip = restArgs(_.unzip);

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    // ---------------
    // 数组转换成对象
    // list: ['name', 'age', 'sex'] values: ['zwb', 21, 1] => {name: 'zwb', age: 21, sex: 1}
    // list: [['name', 'zwb'], ['age', 21], ['sex': 1]] => {name: 'zwb', age: 21, sex: 1}
    _.object = function(list, values) {
        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // Generator function to create the findIndex and findLastIndex functions.
    // --------------------
    // 创建根据dir，创建查找索引函数
    // dir > 0，_.findIndex
    // dir < 0, _.findLastIndex
    var createPredicateIndexFinder = function(dir) {
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            for (; index >= 0 && index < length; index += dir) {
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    };

    // Returns the first index on an array-like that passes a predicate test.
    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    // --------------------
    // 使用二分查找法进行查找
    // array: [10, 26, 30, 40, 50] obj: 35
    // 二分查找规则是：
    // 数组是有序数组
    // 以起始位置大于等于结尾位置结束
    // 确定起始位置和结尾位置的中间位置
    // 如果中间位置的值小于给定的值，起始位置重新赋值为中间位置的后一个位置
    // 如果中间位置的值大于等于给定的值，起始位置重新赋值为当前中间位置
    _.sortedIndex = function(array, obj, iteratee, context) {
        iteratee = cb(iteratee, context, 1);
        // 如果iteratee存在并且是函数或者不存在返回function(value) { return value }
        var value = iteratee(obj);
        // 定义起始位置和结尾位置
        // 这里underscore.js定义的结束位置起始就是在当前数组最后默认添加一个空位置
        var low = 0, high = getLength(array);
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
        }
        return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions.
    var createIndexFinder = function(dir, predicateFind, sortedIndex) {
        return function(array, item, idx) {
            var i = 0, length = getLength(array);
            if (typeof idx == 'number') {
                // idx如果为正，代表在当前方向的idx位置
                // idx如果为负，代表在当前方向推了idx的位置
                if (dir > 0) {
                    // 如果是正向查找
                    // 重置查找位置
                    // 如果查找位置大于等于0，不变
                    // 如果查找位置小于0，确保查找位置大于等于0
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else {
                    // 如果是逆向查找
                    // 重置数组长度
                    // 如果起始值大于等于0，防止起始值超过长度
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            }
            // 如果传入起始位置不是number类型，并且数组是排序好的，不过基本用不到
            else if (sortedIndex && idx && length) {
                idx = sortedIndex(array, item);
                return array[idx] === item ? idx : -1;
            }
            // 如果item是NaN类型，查找数组里面是否有NaN，如果有就返回索引
            if (item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + i : -1;
            }

            // 判断array是否匹配，如果匹配返回索引
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }
            return -1;
        };
    };

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);
})();