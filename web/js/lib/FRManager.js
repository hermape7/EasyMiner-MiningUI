/**
 * Class FRManager
 * @license http://www.apache.org/licenses/LICENSE-2.0 Apache License, Version 2.0
 * @link http://github.com/kizi/easyminer-miningui
 *
 * @type Class
 */
var FRManager = new Class({

  config: null,
  reloadRequestDelay: 8000,
  reloadRequestCounterMax: 5,
  FL: null,
  settings: null,
  i18n: null,
  AJAXBalancer: null,
  UIPainter: null,
  UIListener: null,
  MRManager: null,
  errorMessage: '',

  //newly used variables with information about the state
  task: null,
  pageLoading:false,
  miningInProgress: false,
  importInProgress: false,
  miningInterrupted: false,

  IMs: [],
  rules: [],

  rulesCount: 0,
  rulesOrder: null,
  rulesPerPage: null,
  currentPage: null,
  pagesCount: 0,
  delayedPageRequestTimer: null,//timer used for page reload delay
  delayedPageRequestCounter:0,


  initialize: function (config, FL, settings, UIPainter, UIListener, MRManager, i18n) {
    this.config = config;
    var perPageOptions=this.getPerPageOptions();
    this.rulesPerPage=perPageOptions[0];

    this.FL = FL;
    this.settings = settings;
    this.UIPainter = UIPainter;
    this.UIListener = UIListener;
    this.MRManager = MRManager;
    this.i18n = i18n;
    this.AJAXBalancer = new AJAXBalancer();

    this.MRManager.FRManager = this; // MRManager has to know FRManager
  },

  /**
   * Method called after the start of mining
   */
  handleInProgress: function () {
    this.reset();
    this.miningInProgress = true;
    this.UIPainter.renderActiveRule();
    this.UIPainter.renderFoundRules();
  },

  handleStoppedMining: function (miningState, importState) {
    this.setMiningInProgress(miningState);
    this.setImportInProgress(importState);
    this.UIPainter.renderActiveRule();
    this.UIPainter.renderFoundRules();

    if (!this.miningInProgress && this.importInProgress) {
      this.delayedPageReload();
    }
  },

  delayedPageReload: function(){
    if (this.delayedPageRequestCounter<this.reloadRequestCounterMax){
      //set the delay
      var reloadRequestDelay=this.reloadRequestDelay;
      if (this.delayedPageRequestCounter==0){//in case of first delay, repeat it after shorter time
        reloadRequestDelay=Math.round(this.reloadRequestDelay/2);
      }
      //calculate the next try of loading and running the timer
      this.delayedPageRequestCounter++;
      this.delayedPageRequestTimer=this.gotoPage.delay(reloadRequestDelay,this,(this.currentPage?this.currentPage:0));
    }
  },

  gotoPage: function(page){
    this.delayedPageRequestTimer=null;
    this.pageLoading=true;
    this.UIPainter.renderFoundRules();
    var url = this.config.getGetRulesUrl(this.task.getId(), (page - 1) * this.rulesPerPage, this.rulesPerPage, this.rulesOrder);

    //region load rules from server
    new Request.JSON({
      url: url,
      secure: true,
      onSuccess: function (responseJSON) {
        this.currentPage=page;
        this.handleSuccessRulesRequest(responseJSON);
      }.bind(this),

      onError: function () {
        this.handleErrorRulesRequest(page);
      }.bind(this),

      onFailure: function () {
        this.handleErrorRulesRequest(page);
      }.bind(this),

      onException: function () {
        this.handleErrorRulesRequest(page);
      }.bind(this),

      onTimeout: function () {
        this.handleErrorRulesRequest(page);
      }.bind(this)

    }).get();
    //endregion load rules from server
  },

  setMiningInProgress: function(miningState){
    this.miningInProgress=!(miningState=='solved' || miningState=='interrupted' || miningState=='solved_heads' || miningState=='failed');
    this.miningInterrupted=(miningState=='interrupted' || miningState=='failed');
  },

  setImportInProgress: function(importState){
    this.importInProgress=(importState=='waiting' || importState=='partial');
  },

  handleSuccessRulesRequest: function (data) {
    //get currently used interest measures
    this.pageLoading=false;
    this.IMs = this.FL.getRulesIMs(data.task.IMs);
    this.rules = [];
    if (data.task && data.task.name!=''){
      this.setTaskName(data.task.name);
    }

    Object.each(data.rules, function (value, key) {
      this.rules.push(new FoundRule(key, value, this.task));
    }.bind(this));

    this.setMiningInProgress(data.task.state);
    this.setImportInProgress(data.task.importState);

    if (!this.miningInProgress && this.importInProgress) {
      this.delayedPageReload();
    }
    this.UIPainter.renderFoundRules();
  },

  handleErrorRulesRequest: function (page){
    this.pageLoading=false;
    this.errorMessage=this.i18n.translate('Loading of rules failed...');
    this.UIPainter.renderFoundRules();
  },

  setRulesCount: function(rulesCount){
    this.rulesCount = rulesCount;
    this.calculatePagesCount();
    if (this.rulesCount > 0) {
      this.gotoPage(1);
    }
  },

  renderRules: function (rulesCount, taskName, inProgress, importInProgress, task) {
    this.task = task;
    this.miningInProgress = inProgress;
    this.importInProgress = importInProgress;
    if (taskName!=''){
      this.setTaskName(taskName);
    }
    this.setRulesCount(rulesCount);
    this.UIPainter.renderActiveRule();
    this.UIPainter.renderFoundRules();
  },

  buildFoundRulesRequest: function (foundRules, URL) {
    var options = {
      url: URL,
      secure: true,

      onRequest: function () {
        Array.each(foundRules,function(foundRule){
          foundRule.setLoading(true);
          this.UIPainter.updateFoundRule(foundRule);
        }.bind(this));
      }.bind(this),

      onSuccess: function (responseJSON, responseText) {
        this.handleSuccessFoundRulesRequest(responseJSON,foundRules);
      }.bind(this),

      onError: function () {
        this.handleErrorFoundRulesRequest(foundRules);
      }.bind(this),

      onCancel: function () {
        Array.each(foundRules,function(foundRule){
          foundRule.setLoading(false);
          this.UIPainter.updateFoundRule(foundRule);
        }.bind(this));
      }.bind(this),

      onFailure: function () {
        this.handleErrorFoundRulesRequest(foundRules);
      }.bind(this),

      onException: function () {
        this.handleErrorFoundRulesRequest(foundRules);
      }.bind(this),

      onTimeout: function () {
        this.handleErrorFoundRulesRequest(foundRules);
      }.bind(this)
    };
    var reqData=null;
    if(foundRules.length==1){
      this.AJAXBalancer.addRequest(options, JSON.encode(reqData), foundRules[0].getId());
    }else{
      this.AJAXBalancer.addRequest(options, JSON.encode(reqData));
    }
  },

  handleErrorFoundRulesRequest: function (foundRules) {
    if (foundRules.length>0){
      Array.each(foundRules,function(foundRule){
        foundRule.setLoading(false);
        this.UIPainter.updateFoundRule(foundRule);
      }.bind(this));
    }
  },



  handleSuccessFoundRulesRequest: function (jsonData,foundRules){
    if ((foundRules == undefined)||(foundRules.length==0)){return;}

    Array.each(foundRules,function(foundRule){
      if (jsonData.rules[foundRule.$id]){
        foundRule.initialize(foundRule.$id,jsonData.rules[foundRule.$id],this.task);
      }
      foundRule.setLoading(false);
      this.UIPainter.updateFoundRule(foundRule);
    }.bind(this));

    this.MRManager.reload(this.getTaskId(), this.getTaskName());

  },


  handleError: function () {
    this.miningInProgress = false;
    this.UIPainter.renderActiveRule();
    this.UIPainter.renderFoundRules();
  },

  reset: function () {
    this.AJAXBalancer.stopAllRequests();
    this.errorMessage='';
    this.setRulesCount(0);
    if (this.delayedPageRequestTimer){
      clearTimeout(this.delayedPageRequestTimer);
      this.delayedPageRequestTimer=null;
    }
    this.delayedPageRequestCounter=0;
    this.IMs = this.FL.getRulesIMs([]);
    if(this.rulesOrder==null || this.rulesOrder==''){
      this.rulesOrder=this.IMs[0].getName();
    }
    this.miningInProgress = false;
    this.miningInterrupted= false;
    this.importInProgress = false;
  },

  markFoundRule: function (foundRule) {
    this.AJAXBalancer.stopRequest(foundRule.getId());
    this.buildFoundRulesRequest([foundRule],this.config.getRuleClipboardAddRuleUrl(this.getTaskId(),foundRule.$id));
    this.AJAXBalancer.run();
  },

  unmarkFoundRule: function (foundRule) {
    this.AJAXBalancer.stopRequest(foundRule.getId());
    this.buildFoundRulesRequest([foundRule],this.config.getRuleClipboardRemoveRuleUrl(this.getTaskId(),foundRule.$id));
    this.AJAXBalancer.run();
  },

  cleanFoundRulesIds: function(foundRulesCSSIDs){
    var result=[];
    if (!(foundRulesCSSIDs.length>0)){
      return result;
    }
    var taskId=this.getTaskId();
    Array.each(foundRulesCSSIDs,function(id){
      var regExp=/^found-rule-(.+)-(\d+)-checkbox$/;
      var idArr=id.split('-');
      if(regExp.test(id)){
        if(taskId!=idArr[2]){
          return;
        }
        result.push(idArr[3]);
      }
    }.bind([taskId,result]));
    return result;
  },

  getFoundRulesByIds: function(foundRulesIds){
    var result=[];
    if (this.rules.length>0){
      Array.each(this.rules,function(rule){
        if (foundRulesIds.indexOf(rule.$id)>-1){
          result.push(rule);
        }
      }.bind([foundRulesIds,result]));
    }
    return result;
  },

  multiMarkFoundRules:function(foundRulesIds){
    var selectedFoundRules=this.getFoundRulesByIds(this.cleanFoundRulesIds(foundRulesIds));
    if (selectedFoundRules.length==0){return;}
    var urlIds=[];
    Array.each(selectedFoundRules,function(foundRule){
      urlIds.push(foundRule.$id);
      this.AJAXBalancer.stopRequest(foundRule.getId());
      foundRule.setLoading(true);
    }.bind(this));
    urlIds=urlIds.join(',');
    this.buildFoundRulesRequest(selectedFoundRules,this.config.getRuleClipboardAddRuleUrl(this.getTaskId(),urlIds));
    this.AJAXBalancer.run();
  },

  markAllFoundRules: function(){
    this.AJAXBalancer.stopAllRequests();
    var urlIds=[];
    Array.each(this.rules,function(foundRule){
      urlIds.push(foundRule.$id);
      foundRule.setLoading(true);
    }.bind(this));
    this.buildFoundRulesRequest(this.rules,this.config.getRuleClipboardAddAllRulesUrl(this.getTaskId(),urlIds));
    this.AJAXBalancer.run();
  },

  multiUnmarkFoundRules:function(foundRulesIds){
    var selectedFoundRules=this.getFoundRulesByIds(this.cleanFoundRulesIds(foundRulesIds));
    if (selectedFoundRules.length==0){return;}
    var urlIds=[];
    Array.each(selectedFoundRules,function(foundRule){
      urlIds.push(foundRule.$id);
      this.AJAXBalancer.stopRequest(foundRule.getId());
      foundRule.setLoading(true);
    }.bind(this));
    urlIds=urlIds.join(',');
    this.buildFoundRulesRequest(selectedFoundRules,this.config.getRuleClipboardRemoveRuleUrl(this.getTaskId(),urlIds));
    this.AJAXBalancer.run();
  },

  /**
   * Renames the task.
   * @param taskId Task id to rename.
   * @param newTaskName A new task name to set.
   */
  renameTask: function (taskId, newTaskName) {

    new Request.JSON({
      url: this.config.getTaskRenameUrl(taskId,newTaskName),
      secure: true,
      onSuccess: function () {
        this.handleRenameTaskFinished(taskId,newTaskName);
      }.bind(this),

      onError: function () {
        this.handleRenameTaskError(taskId);
      }.bind(this),

      onFailure: function () {
        this.handleRenameTaskError(taskId);
      }.bind(this),

      onException: function () {
        this.handleRenameTaskError(taskId);
      }.bind(this),

      onTimeout: function () {
        this.handleRenameTaskError(taskId);
      }.bind(this)
    }).get();

  },

  handleRenameTaskFinished: function(taskId, newTaskName){
    if (this.getTaskId() == taskId){
      //if the current task is renamed, we have to repaint it (reload the current page with rules)
      this.gotoPage(this.currentPage);
    }
    this.MRManager.setTaskName(taskId, newTaskName)
  },

  // duplicated handleRenameTaskFinished due to difference of result for MRManager
  handleRenameTaskError: function(taskId){
    if (this.getTaskId() == taskId){
      //if is is current task, we have to repaint it (reload the current page with rules)
      this.gotoPage(this.currentPage);
    }
  },

  getPerPageOptions: function(){
    return this.config.getPerPageOptions();
  },

  getPaginatorType: function(){
    return this.config.getPaginatorType();
  },

  setRulesPerPage: function(count){
    this.rulesPerPage=count;
    this.calculatePagesCount();
    this.gotoPage(1);
  },

  calculatePagesCount: function(){
    this.pagesCount=Math.ceil(this.rulesCount/this.rulesPerPage);
  },

  setTaskName: function(name){
    this.task.setName(name);
  },

  getTaskName: function(){
    return this.task.getName();
  },

  getTaskId: function(){
    return (this.task == undefined) ? 0 : this.task.getId();
  },

  getKBSelectedRuleSet: function(){
    return this.MRManager.KBid;
  },

  //region work with knowledge base

  kbAddRule: function (foundRule, relation) {
    this.AJAXBalancer.stopRequest(foundRule.getId());
    this.buildFoundRulesRequest([foundRule],this.config.getKnowledgeBaseAddRulesUrl(this.getKBSelectedRuleSet(),foundRule.getId(true),relation,true));
    this.AJAXBalancer.run();
  },

  kbRemoveRule: function (foundRule) {
    this.AJAXBalancer.stopRequest(foundRule.getId());
    this.buildFoundRulesRequest([foundRule],this.config.getKnowledgeBaseRemoveRulesUrl(this.getKBSelectedRuleSet(),foundRule.getId(true),true));
    this.AJAXBalancer.run();
  },

  multiKBAddRules: function (foundRulesIds, relation) {
    var selectedFoundRules=this.getFoundRulesByIds(this.cleanFoundRulesIds(foundRulesIds));
    if (selectedFoundRules.length==0){return;}
    var urlIds=[];
    Array.each(selectedFoundRules,function(foundRule){
      urlIds.push(foundRule.$id);
      this.AJAXBalancer.stopRequest(foundRule.getId());
      foundRule.setLoading(true);
    }.bind(this));
    urlIds=urlIds.join(',');
    this.buildFoundRulesRequest(selectedFoundRules,this.config.getKnowledgeBaseAddRulesUrl(this.getKBSelectedRuleSet(),urlIds,relation,true));
    this.AJAXBalancer.run();
  },

  multiKBRemoveRules: function (foundRulesIds) {
    var selectedFoundRules=this.getFoundRulesByIds(this.cleanFoundRulesIds(foundRulesIds));
    if (selectedFoundRules.length==0){return;}
    var urlIds=[];
    Array.each(selectedFoundRules,function(foundRule){
      urlIds.push(foundRule.$id);
      this.AJAXBalancer.stopRequest(foundRule.getId());
      foundRule.setLoading(true);
    }.bind(this));
    urlIds=urlIds.join(',');
    this.buildFoundRulesRequest(selectedFoundRules,this.config.getKnowledgeBaseRemoveRulesUrl(this.getKBSelectedRuleSet(),urlIds,true));
    this.AJAXBalancer.run();
  }

  //endregion work with knowledge base


});