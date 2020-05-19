const pino = require("pino");
const numeral = require("numeral");

const logger = pino({
    level: process.env.LOGGER || "info",
    prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:yyyy-yy-dd HH:MM:ss.l",
        crlf: true,
    },
    prettifier: require("pino-pretty"),
});

class FlowControl {
    constructor(maxFlow = 0, name = "默认流控") {
        // 当前正在执行的任务数量
        this._count = 0;

        // 网络请求每分钟的最大次数
        this._maxFlow = maxFlow;
        // 两次任务之间的最小间隔
        this._minInterval = (60 * 1000) / this._maxFlow;

        // 用于日志显示
        this._name = name;

        // 上一个任务执行时间
        this._lastExecuteTime = 0;

        // 等待执行的任务队列
        this._taskQueue = [];

        // 总的执行时间，毫秒
        this._totalTime = 0;
        // 总的执行任务数
        this._total = 0;
    }

    /**
     * 调用器，将异步任务函数和它的参数传入
     * @param {Function} caller 异步任务函数，它必须是async函数或者返回Promise的函数
     * @param {Array} args 异步任务函数的参数列表
     * @returns {Promise<unknown>} 返回一个新的Promise
     */
    call(caller, ...args) {
        // console.log(`【${this._name}】 调用，${typeof (caller)}, ${args}`)
        return new Promise((resolve, reject) => {
            const task = this._createTask(caller, args, resolve, reject);
            // 添加任务后，启动任务检查执行
            if (this._taskQueue.length <= 0) {
                setTimeout(() => {
                    this._executeTask();
                }, 0);
            }

            this._taskQueue.push(task);
        });
    }

    _checkFlow() {
        if (this._maxFlow > 0) {
            // maxFlow设置为每分钟可以访问的次数，则>0表示有设置，0表示不限制
            let now = Date.now();

            // 简单的采用请求间隔时间来控制流速
            if (now - this._lastExecuteTime < this._minInterval) {
                // 如果当前时间到上一次间隔时间小于流控间隔时间，则返回false，这样用于确保每次执行都是均匀发出的
                return false;
            }
            this._lastExecuteTime = now;
            return true;
        }
        return true;
    }

    _executeTask() {
        try {
            // 如果任务队列空，则不再继续检查
            // logger.debug(`【${this._name}】流控检查 ...`);
            if (this._taskQueue && this._taskQueue.length > 0) {
                if (this._checkFlow() === false) {
                    // console.log("count >= max, 当前线程池满，等待空闲")
                    // } else if (this._checkFlow() === false) {
                    // logger.debug(`【${this._name}】 流控未通过, 等待空闲`);
                } else {
                    this._lastExecuteTime = Date.now();
                    let task = this._taskQueue.shift();
                    // console.log("执行任务...")
                    task();
                    let averageTime = 0;
                    if (this._total > 0) {
                        averageTime = this._totalTime / this._total / 1000;
                    }
                    logger.debug(
                        `【${this._name}】执行任务，正在运行${
                            this._count
                        } 个任务，剩余${
                            this._taskQueue.length
                        }个任务，平均执行时间：${numeral(averageTime).format(
                            "0.000"
                        )}秒`
                    );
                }
            }
        } catch (error) {
            logger.error(`【${this._name}】 发生未知异常：%o`, error);
        }

        if (this._taskQueue && this._taskQueue.length > 0) {
            setTimeout(() => {
                this._executeTask();
            }, 0);
        }
    }

    /**
     * 创建一个任务
     * @param {Function} caller 实际执行的函数
     * @param {Array} args 执行函数的参数
     * @param {Object} resolve 对应任务包装Promise的resolve
     * @param {Object} reject 对应任务包装Promise的Reject
     * @returns {Function} 返回一个任务函数
     * @private
     */
    _createTask(caller, args, resolve, reject) {
        return () => {
            let beginTime = Date.now();
            // 实际上是在这里调用了异步任务，并将异步任务的返回（resolve和reject）抛给了上层
            caller(...args)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this._count--;
                    let outputArgs = args.map((arg) => {
                        if (arg && arg.hasOwnProperty("token")) {
                            //arg.token = null
                            delete arg.token;
                        }
                        return arg;
                    });
                    let executeime = Date.now() - beginTime;
                    this._total++;
                    this._totalTime += executeime;

                    logger.debug(
                        `【${this._name}】结束任务，正在运行${
                            this._count
                        }个任务，剩余任务${
                            this._taskQueue.length
                        }个，本次任务：%o，使用时间 ${numeral(
                            executeime / 1000
                        ).format("0.000")}秒`,
                        outputArgs
                    );
                });
            this._count++;
        };
    }
}

export default FlowControl;
// module.exports.FlowControl = FlowControl
