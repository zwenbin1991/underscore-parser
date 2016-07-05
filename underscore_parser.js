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
        // 和ES5使用一致
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

})();