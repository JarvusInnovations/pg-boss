const EventEmitter = require('events').EventEmitter; //node 0.10 compatibility;
const assert = require('assert');

const Attorney = require('./attorney');
const Contractor = require('./contractor');
const Manager = require('./manager');
const Boss = require('./boss');

const notReadyErrorMessage = `boss ain't ready.  Use start() or connect() to get started.`;

class PgBoss extends EventEmitter {
    static getConstructionPlans(schema) {
        return Contractor.constructionPlans(schema);
    }

    static getMigrationPlans(schema, version, uninstall) {
        return Contractor.migrationPlans(schema, version, uninstall);
    }
    
    constructor(config){
        config = Attorney.checkConfig(config);

        super();

        this.config = config;

        // contractor makes sure we have a happy database home for work
        this.contractor = new Contractor(config);

        // boss keeps the books and archives old jobs
        var boss = new Boss(config);
        this.boss = boss;
        boss.on('error', error => this.emit('error', error));
        boss.on('archived', count => this.emit('archived', count));

        // manager makes sure workers aren't taking too long to finish their jobs
        var manager = new Manager(config);
        this.manager = manager;
        manager.on('error', error => this.emit('error', error));
        manager.on('job', job => this.emit('job', job));
        manager.on('expired', count => this.emit('expired', count));
    }

    init() {
        if(!this.isReady){
            return this.boss.supervise()
                .then(() => this.manager.monitor())
                .then(() => {
                    this.isReady = true;
                    return this;
            });
        }
        else
            return Promise.resolve(this);
    }


    start() {
        return this.contractor.start.apply(this.contractor, arguments)
            .then(() => this.init());
    }

    stop() {
        return Promise.all([
            this.disconnect(),
            this.manager.stop(),
            this.boss.stop()
        ]);
    }

    connect() {
        return this.contractor.connect.apply(this.contractor, arguments)
            .then(() => {
                this.isReady = true;
                return this;
            });
    }

    disconnect() {
        if(!this.isReady) return Promise.reject(notReadyErrorMessage);
        return this.manager.close.apply(this.manager, arguments)
            .then(() => this.isReady = false);
    }
    
    cancel(){
        if(!this.isReady) return Promise.reject(notReadyErrorMessage);
        return this.manager.cancel.apply(this.manager, arguments);
    }
    
    subscribe(){
        if(!this.isReady) return Promise.reject(notReadyErrorMessage);
        return this.manager.subscribe.apply(this.manager, arguments);
    }

    publish(){
        if(!this.isReady) return Promise.reject(notReadyErrorMessage);
        return this.manager.publish.apply(this.manager, arguments);
    }
}

module.exports = PgBoss;
