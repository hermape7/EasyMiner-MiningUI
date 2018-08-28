var UIPainter = new Class({

  ARBuilder: null,
  config: null,
  $settings: null,
  UIColorizer: null,
  UIListener: null,
  dateHelper: null,
  UITemplateRegistrator: null,
  $UIScroller: null,
  $UIStructurePainter: null,
  AttributeValuesManager: null,

  pager: null,

  rootElement: null,
  i18n: null,

  callbackStack: [],

  // sort attributes
  sortDuration: 750,
  morphDuration: 500,

  // dispose element
  disposeDuration: 750,

  // Overlay height, used when manipulating with its position
  overlayHeight: null,

  // Settings window top margin, used when manipulating with overlay position
  settingsWindowTopMargin: null,

  initialize: function (ARBuilder, config, settings, i18n, UIColorizer, UIListener, dateHelper, UITemplateRegistrator, UIScroller, UIStructurePainter, AttributeValuesManager) {
    this.ARBuilder = ARBuilder;
    this.config = config;
    this.$settings = settings;
    this.rootElement = $(this.config.getRootElementId());
    this.i18n = i18n;
    this.UIColorizer = UIColorizer;
    this.UIListener = UIListener;
    this.dateHelper = dateHelper;
    this.UITemplateRegistrator = UITemplateRegistrator;
    this.$UIScroller = UIScroller;
    this.$UIStructurePainter = UIStructurePainter;
    this.AttributeValuesManager = AttributeValuesManager;
  },

  createUI: function () {
    this.renderMinerBasicInfo();
    this.renderNavigation();
    this.renderActiveRule();
    //this.renderMarkedRules();
  },

  renderNavigation: function () {
    // attributes
    this.renderAttributes();
    this.showAddAllUnusedAttributesLink();
    // data fields
    this.renderDataFields();
  },

  renderAttributes: function (navigation) {
    if (this.ARBuilder.getARManager().getAttributesByGroup() === true) {
      this.renderAttributesByGroup(navigation.getElement('ul'));
    } else {
      this.renderAttributesByList();
    }

    if (this.ARBuilder.getDD().hasHiddenAttributes()) {
      this.$UIStructurePainter.showHiddenAttributesButton();
    } else {
      this.$UIStructurePainter.hideHiddenAttributesButton();
    }

    var attributesFilter = $$('#attributes a.filter')[0];
    this.ARBuilder.attributesFilter = new ElementFilter('attributes-filter', '#attributes-by-list li', {
      trigger: 'keyup',
      cache: true,
      matchAnywhere: false,
      supportSimpleCompletion: true,
      initRepaint: true,
      onShow: function (element) {
        element.show('flex')
      },
      onHide: function (element) {
        element.hide()
      },
      onComplete: function (element) {
        attributesFilter.addClass('filter-active');
        this.showAddAllUnusedAttributesLink();
      }.bind(this),
      onNull: function (element) {
        attributesFilter.removeClass('filter-active');
        this.showAddAllUnusedAttributesLink();
      }.bind(this)
    });
    this.UIListener.checkAttributesSelectedCheckboxes();
  },

  showAddAllUnusedAttributesLink: function () {
    var ARManager = this.ARBuilder.getARManager();
    var activeRule = ARManager.getActiveRule();
    if (!this.ARBuilder.attributesFilter) {
      return;
    }
    var attributeNameFilter = this.ARBuilder.attributesFilter.prepareTestRegExp();
    var allowAddAllUnusedAttributesLink = false;
    Array.each(this.ARBuilder.getDD().getAttributes(), function (attribute) {
      if (activeRule.isAttributeUsed(attribute)) {
        return;
        /*atribut je už použit*/
      }
      if (!attributeNameFilter.test(attribute.getName())) {
        return;
        /*jméno atributu neodpovídá aktivnímu filtru*/
      }
      if ((attribute.isHidden())) {
        return;
        /*jde o skrytý atribut*/
      }
      allowAddAllUnusedAttributesLink = true;
    }.bind(this));
    if (allowAddAllUnusedAttributesLink) {
      $('add-all-unused-attributes').show();
    } else {
      $('add-all-unused-attributes').hide();
    }

  },

  renderAttributesByGroup: function (elementParent) {
    elementParent = elementParent || $$('nav#navigation ul')[0];
    elementParent.setAttribute('id', 'attributes-by-group');
    if (elementParent.hasChildNodes()) {
      elementParent.empty();
    }

    elementParent.grab(this.initFieldGroup(this.ARBuilder.getFGC().getFieldGroupRootConfigID()));
    while (callback = this.callbackStack.pop()) {
      callback.func.apply(this.UIListener, callback.args);
    }
  },

  renderAttributesByList: function () {
    var elementParent = $$('nav#navigation ul')[0];
    elementParent.setAttribute('id', 'attributes-by-list');
    if (elementParent.hasChildNodes()) {
      elementParent.empty();
    }

    Object.each(this.ARBuilder.getDD().getAttributes(), function (attribute) {
      this.renderAttributeByList(attribute, elementParent);
    }.bind(this));
  },

  renderAttributeByList: function (attribute, elementParent) {
    if (elementParent) { // insert
      var elementAttribute = Mooml.render('attributeByListTemplate', {
        i18n: this.i18n,
        isUsed: this.ARBuilder.getARManager().getActiveRule().isAttributeUsed(attribute),
        attribute: attribute,
        showEditAttribute: this.$settings.isAttributeEditAllowed(),
        showRemoveAttribute: this.$settings.isAttributeDeleteAllowed()
      });
      elementParent.grab(elementAttribute);
      this.UIListener.registerAttributeEventHandler(attribute, this.$settings.isAttributeEditAllowed(), this.$settings.isAttributeDeleteAllowed());
    } else { // re-render
      var element = $(attribute.getCSSID());
      element.set('morph', {duration: this.morphDuration});
      element.removeAttribute('class');
      if (attribute.isRecommended()) {
        element.addClass('rec1');
      } else if (attribute.isPartiallyRecommended()) {
        element.addClass('rec2');
      } else if (this.ARBuilder.getARManager().getActiveRule().isAttributeUsed(attribute)) {
        element.morph({//TODO tohle předělat na třídu...
          'color': '#AAA'
        });
      } else {
        element.morph({
          'color': '#434343'
        });
      }
    }
  },

  renderAddAttributeWindow: function (field) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var url = this.config.getAddAttributeURL(field.getId());
    var window = Mooml.render('addAttributeTemplate', {i18n: this.i18n, url: url});
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();
    this.$UIStructurePainter.posOverlay();
  },

  renderAddAttributesWindow: function (fields) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var url = this.config.getAddAttributesURL(fields);
    var window = Mooml.render('addAttributesTemplate', {i18n: this.i18n, url: url});
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();
    this.$UIStructurePainter.posOverlay();
  },

  renderEditAttributeWindow: function (attribute) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var url = this.config.getEditAttributeURL(attribute.getName());
    var window = Mooml.render('editAttributeTemplate', {i18n: this.i18n, url: url});
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderShowHistogramWindow: function (id, type) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var window = Mooml.render('showHistogramTemplate', {
      i18n: this.i18n,
      url: this.config.getShowHistogramURL(id, type)
    });
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderReportWindow: function (id, name) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var window = Mooml.render('reportWindowTemplate', {i18n: this.i18n, url: this.config.getShowReportUrl(id)});
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  removeAttribute: function (attribute) {
    $(attribute.getCSSID()).getParent().destroy();
  },

  renderDataFields: function () {
    var dataFields = $$('#data-fields ul')[0];
    var dataFieldsList = this.ARBuilder.getDD().getFields();
    // sort data fields by name
    dataFieldsList.sort(function (a, b) {
      if (a.$name.toLowerCase() < b.$name.toLowerCase()) {
        return -1;
      }
      if (a.$name.toLowerCase() > b.$name.toLowerCase()) {
        return 1;
      }
      return 0;
    });

    dataFields.empty();
    dataFieldsList.each(function (field) {
      this.renderDataField(field, dataFields);
      this.UIListener.registerDataFieldEventHandler(field);
    }.bind(this));
    var dataFieldsFilter = $$('#data-fields a.filter')[0];
    var myFilter = new ElementFilter('data-fields-filter', '#data-fields li', {
      trigger: 'keyup',
      cache: true,
      matchAnywhere: false,
      supportSimpleCompletion: true,
      onShow: function (element) {
        element.show('flex')
      },
      onHide: function (element) {
        element.hide()
      },
      onComplete: function (element) {
        dataFieldsFilter.addClass('filter-active');
      },
      onNull: function (element) {
        dataFieldsFilter.removeClass('filter-active');
      }
    });
  },

  renderDataField: function (field, elementParent) {
    elementParent.grab(Mooml.render('dataFieldTemplate', {i18n: this.i18n, field: field}));
  },

  sortAttributes: function (positions) {
    var sorter = new Fx.Sort($$('#attributes > div > ul > li'), {
      transition: Fx.Transitions.Cubic.easeInOut,
      duration: this.sortDuration
    });

    sorter.sort(positions).chain(function () {
      // sorter.rearrangeDOM();

      Array.each(this.ARBuilder.getDD().getAttributes(), function (attribute) {
        this.renderAttributeByList(attribute);
      }.bind(this));

      this.renderAttributes.delay((this.sortDuration + this.morphDuration) * 1.5, this);
    }.bind(this));

  },

  renderReports: function (reports) {
    var elReports = $$('#reports ul')[0];
    elReports.empty();
    reports.each(function (report) {
      this.renderReport(report, elReports);
    }.bind(this));
  },

  renderReport: function (report, elParent) {
    elParent.grab(Mooml.render('reportTemplate', {
      i18n: this.i18n,
      report: report,
      url: this.config.getShowReportUrl(report.id)
    }));
//        this.UIListener.registerReportEventHandler(report);
  },

  renderChangeRulesetWindow: function () {
    var overlay = this.$UIStructurePainter.showOverlay();

    var window = Mooml.render('changeRulesetWindowTemplate', {
      i18n: this.i18n
    });
    overlay.grab(window);

    this.ARBuilder.$MRManager.getRuleSetsRequest();
    this.UIListener.registerOverlayEventHandlers();
  },

  renderExportWindow: function (taskId, type, isMiningInProgress, isImportInProgress) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var url = "",
      links = [],
      errorMsg = this.i18n.translate('Unable to load export links! Try it again later.');

    if (type == 'ruleset') {
      links = this.config.getKnowledgeBaseExportLinks(taskId);
      //ignore the info about import of mining results (we do not work with task, but ruleset)
      isMiningInProgress = false;
      isImportInProgress = false;
    } else if (type == 'discovered') {
      links = this.config.getDiscoveredRulesExportLinks(taskId);
    } else {
      links = this.config.getRuleClipboardExportLinks(taskId);
    }

    var window = Mooml.render('exportWindowTemplate', {
      i18n: this.i18n,
      type: type,
      links: links,
      isMiningInProgress: isMiningInProgress,
      isImportInProgress: isImportInProgress
    });
    overlay.grab(window);

    this.UIListener.registerOverlayEventHandlers();
  },

  renderRulesetsList: function (data, selectedId) {
    var ruleSetsListElm = $('change-ruleset-list');
    ruleSetsListElm.empty();
    var currentRulesetElm = $('current-ruleset');
    currentRulesetElm.empty();
    Object.each(data, function (value, id) {
      if (id == selectedId) {
        value['selected'] = 'selected';
        currentRulesetElm.grab(Mooml.render('changeRulesetWindowItemTemplate', value));
      } else {
        ruleSetsListElm.grab(Mooml.render('changeRulesetWindowItemTemplate', value));
      }
    }.bind(this));
    this.UIListener.registerChangeRulesetEventHandler();
    this.$UIStructurePainter.posOverlay();
  },

  renderAddRulesetForm: function () {
    var changeRulesetBox = $('change-ruleset-window'),
      addRulesetInput = $('add-ruleset');
    changeRulesetBox.grab(Mooml.render('changeRulesetWindowAddTemplate', {i18n: this.i18n}));
    addRulesetInput.hide();
    this.UIListener.registerAddRulesetFormEventHandler();
  },

  removeAddRulesetForm: function () {
    var addRulesetForm = $('add-ruleset-form'),
      addRulesetInput = $('add-ruleset');
    addRulesetForm.destroy();
    addRulesetInput.show();
  },

  renderActiveRuleset: function (name, count) {
    var activeRulesetElm = $('kb-ruleset');
    if (name == '') {
      name = this.i18n.translate('(unnamed ruleset)');
    }
    Mooml.render('activeRulesetTemplate', {
      i18n: this.i18n,
      name: name,
      count: count
    }).replaces(activeRulesetElm);
  },

  // to render only task
  renderMarkedTask: function (task, status) {
    var taskElm = $('task-' + task.id),
      taskStatus = (typeof status == 'undefined') ? taskElm.getProperty('class') : status,
      mrElement = $$('#marked-rules div.marked-rules-tasks-content')[0],
      newTaskElm = Mooml.render('taskTemplate',
        {
          i18n: this.i18n,
          FRManager: task,
          status: taskStatus
        }
      );
    if (task.isBase) {
      mrElement = $$('#marked-rules div.marked-rules-base-content')[0]
    }
    if (taskElm != undefined) {
      newTaskElm.replaces(taskElm);
    } else {
      var where = 'bottom';
      if (mrElement.hasClass('empty')) {
        mrElement.removeClass('empty');
        //mrElement.getElement('div#marked-rules-empty').destroy();
      }
      if (status == 'minimize') {
        where = 'top';
      }
      mrElement.grab(newTaskElm, where);
    }
    this.UIListener.registerMarkedRulesEventHandlers(task);
    this.UIListener.registerMarkedRulesMultiControlsEventHandlers(task.id);
  },

  // removes marked tasks div
  removeMarkedTask: function (taskId, isBase) {
    var typeElm = (isBase ? 'base' : 'tasks'),
      mrElement = $$('#marked-rules div.marked-rules-' + typeElm + '-content')[0],
      taskElm = $('task-' + taskId);
    if (taskElm) {
      $('task-' + taskId).destroy();
    }
    if (mrElement.getElements('div.marked-rules-task-name').length <= 1) {
      mrElement.addClass('empty');
    }
  },

  // same as updateFoundRule only template difference TODO merge
  updateMarkedRule: function (foundRule) {
    var foundRuleElement = $(foundRule.getCSSID());
    if (!foundRuleElement) {
      return;
    }

    Mooml.render('markedRuleTemplate', {
      i18n: this.i18n,
      IMs: foundRule.$task.IMs,
      rule: foundRule
    }).replaces(foundRuleElement);

    this.UIListener.registerMarkedRuleEventHandlers(foundRule);
  },

  renderMarkedRules: function (task) {
    Mooml.render('markedRulesOrderTemplate', {
      FRManager: task,
      i18n: this.i18n
    }).replaces($('marked-rules-order-' + task.id));
    var listElm = $$('#task-' + task.id + ' ul')[0],
      template = (task.isBase) ? 'KBRuleTemplate' : 'markedRuleTemplate';
    listElm.empty();
    Object.each(task.rules, function (MR) {
      listElm.grab(Mooml.render(template,
        {
          i18n: this.i18n,
          IMs: task.IMs,
          rule: MR
        }
      ));
      this.UIListener.registerMarkedRuleEventHandlers(MR);
    }.bind(this));
  },

  initFieldGroup: function (id) { // recursive
    var FG = this.ARBuilder.getFGC().getFieldGroup(id);

    var returnEl = new Element('li', {
      id: 'fg-' + id + '-name',
      'class': 'field-group-drag',
      html: '<span>' + FG.getLocalizedName() + '</span>',
      title: FG.getExplanation()
    });
    var FGEl = new Element('ul', {id: 'fg-' + id, 'class': 'field-group'}).inject(returnEl);
    this.callbackStack.push({func: this.UIListener.registerFieldGroupEventHandler, args: [FG]});

    if (Object.getLength(FG.getFields()) > 0) {
      Object.each(FG.getFields(), function (field, key) {
        new Element('li', {id: field.getCSSID(), html: field.toString()}).inject(FGEl);
        this.callbackStack.push({func: this.UIListener.registerFieldEventHandler, args: [field]});
      }.bind(this));
    }

    Array.each(FG.getChildGroups(), function (value, key) {
      this.initFieldGroup(value).inject(FGEl); // call recursion
    }.bind(this));

    return returnEl;
  },

  renderMinerBasicInfo: function () {
    var minerType = this.ARBuilder.getMinerType();
    var applicationMainTitle = $('applicationMainTitle');
    if (applicationMainTitle && minerType) {
      applicationMainTitle.addClass('type' + minerType.toUpperCase());
    }
    var minerName = this.ARBuilder.getMinerName();
    if (minerName) {
      document.title = minerName + ' :: ' + config.titleAppName;
      var applicationSubTitle = $('applicationSubTitle');
      if (applicationSubTitle) {
        applicationSubTitle.set('text', minerName);
        applicationSubTitle.set('title', this.i18n.translate('Current miner name: ') + minerName);
      }
    }
  },

  renderActiveRule: function () {
    var ARManager = this.ARBuilder.getARManager();

    Mooml.render(
      'activeRuleTemplate',
      {
        rules: ARManager.display4ftTaskBox(),
        attributes: ARManager.displayETreeTaskBox(),
        i18n: this.i18n,
        displayAddIM: ARManager.hasPossibleIMs(),
        miningInProgress: ARManager.miningInProgress(),
        activeRuleChanged: ARManager.getActiveRule().isChanged(),
        miningState: ARManager.getMiningState(),
        foundRulesCount: this.ARBuilder.$FRManager.rulesCount,
        pruningAllowed: ARManager.isRulePruningEnabled(),
        pruningActive: ARManager.isRulePruningActive(),
        pruningAvailable: ARManager.isRulePruningAvailable()
      }
    ).replaces($('active-rule'));

    var elementParent = $('antecedent');
    this.renderCedent(this.ARBuilder.getARManager().getActiveRule().getAntecedent(), elementParent);

    Object.each(this.ARBuilder.getARManager().getActiveRule().getIMs(), function (IM, key) {
      this.renderIM(IM);
    }.bind(this));

    var elementParent = $('succedent');
    this.renderCedent(this.ARBuilder.getARManager().getActiveRule().getSuccedent(), elementParent);

    this.UIListener.registerActiveRuleEventHandlers(this.ARBuilder.getARManager().getActiveRule());

    this.$UIStructurePainter.resizeApplication();
  },

  renderCedent: function (cedent, elementParent) {
    var elementCedent = Mooml.render('cedentTemplate', {
      rule: this.ARBuilder.getARManager().getActiveRule(),
      cedent: cedent,
      i18n: this.i18n
    });
    if (elementParent !== null) { // new cedent
      elementParent.grab(elementCedent);
    } else { // re-render
      // re-render
      elementCedent.replaces($(cedent.getCSSID()));
    }

    var noRestriction = this.ARBuilder.getDefFL().hasCedentNoRestriction(cedent);
    if (noRestriction) {
      tips = new Tips('.no-restriction');
      tips.addEvent('show', function (tip, el) {
        tip.addClass('tip-visible');
      });
      tips.addEvent('hide', function (tip, el) {
        tip.removeClass('tip-visible');
      });

      var elementNoRestriction = Mooml.render('noRestrictionTemplate', {i18n: this.i18n});
      elementParent.grab(elementNoRestriction);
      tips.attach(elementNoRestriction);
    }

    var elementFields = elementCedent.getElement('div.fields');

    var index = 1;

    if (cedent.hasOpeningBracket(index)) {
      var elementLeftBracket = Mooml.render('bracketTemplate', {isLeft: true});
      elementFields.grab(elementLeftBracket);
    }

    var settings = this.ARBuilder.getARManager().getActiveRule().toSettings()[cedent.getScope()];
    var markFieldsAllowed = (cedent.getNumFields(cedent.getLevel()) > 2) &&
      (this.ARBuilder.getDefFL().isConnectiveAllowed('Conjunction', cedent.getScope(), settings, cedent.getNextLevel()) || this.ARBuilder.getDefFL().isConnectiveAllowed('Disjunction', cedent.getScope(), settings, cedent.getNextLevel()));

    cedent.getChildren().each(function (child) {
      if (instanceOf(child, Cedent)) { // Cedent
        this.renderCedent(child, elementFields);
      } else { // FieldAR
        this.renderField(child, elementFields, cedent, markFieldsAllowed);
      }

      if (index < cedent.getNumChildren()) { // Connective
        if (this.ARBuilder.getARManager().getFLConnectives(cedent.getScope()).length > 1) {
          this.renderConnective(cedent.getConnective(), elementFields, true);
          this.UIListener.registerCedentConnectiveEventHandlers(cedent);
        } else {
          this.renderConnective(cedent.getConnective(), elementFields, false);
        }
      }

      index++;
    }.bind(this));

    if (cedent.hasClosingBracket(index - 1)) {
      var rightBracket = Mooml.render('bracketTemplate', {isLeft: false});
      elementFields.grab(rightBracket);
    }

    this.UIListener.registerCedentEventHandlers(cedent, this.ARBuilder.getARManager().getActiveRule());
  },

  renderField: function (field, elementParent, cedent, markFielsdAllowed) {
    if (elementParent !== null) { // new field
      var elementField = Mooml.render('fieldTemplate', {
        field: field,
        i18n: this.i18n,
        markFieldAllowed: markFielsdAllowed
      });
      elementParent.grab(elementField);
    } else { // re-render
      var elementField = Mooml.render('fieldTemplate', {
        field: field,
        i18n: this.i18n,
        markFieldAllowed: markFielsdAllowed
      });
      elementField.replaces($(field.getCSSID()));
    }

    if (field.getType() !== null) {
      this.UIListener.registerEditCoefficientEventHandler(field);
      this.UIListener.registerFieldAREventHandlers(field, cedent);
    }
  },

  renderConnective: function (connective, elementParent, editable) {
    var elementConnective = Mooml.render('connectiveTemplate', {
      connective: connective,
      i18n: this.i18n,
      editable: editable
    });
    elementParent.grab(elementConnective);
  },

  renderIM: function (IM) {
    var elementParent = $$('div#interest-measures > div')[0];
    elementParent.grab(Mooml.render('interestMeasureTemplate', {IM: IM, i18n: this.i18n}));
    this.UIListener.registerIMEventHandler(IM);
  },

  renderAddIMWindow: function (IMs) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('addIMWindowTemplate', {i18n: this.i18n}));
    var selectedIM = IMs[Object.keys(IMs)[0]];
    Object.each(IMs, function (IM) {
      var isSelected = (IM.getName() === selectedIM.getName());
      $('add-im-select').grab(Mooml.render('IMWindowSelectOptionTemplate', {IM: IM, isSelected: isSelected}));
    }.bind(this));

    this.renderExplanation(selectedIM);
    this.renderIMAutocomplete('add', selectedIM);

    this.UIListener.registerIMFormEventHandler('add');
    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderEditIMWindow: function (IMs, selectedIM) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('editIMWindowTemplate', {i18n: this.i18n, IM: selectedIM}));
    Object.each(IMs, function (IM) {
      var isSelected = (IM.getName() === selectedIM.getName());
      $('edit-im-select').grab(Mooml.render('IMWindowSelectOptionTemplate', {IM: IM, isSelected: isSelected}));
    }.bind(this));

    this.renderExplanation(selectedIM);
    this.renderIMAutocomplete('edit', selectedIM);

    this.UIListener.registerIMFormEventHandler('edit');
    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderIMAutocomplete: function (action, IM) {
    var elAutocomplete = $(action + '-im-form').getElement('.autocomplete').empty();
    Array.each(IM.getFields(), function (f) {
      new InterestMeasureSlider(elAutocomplete, f, action, IM, IM.getName() === 'SUPP' ? this.ARBuilder.getDD().calculateMinimalSupport() : this.ARBuilder.getDD().getRecordCount(), this.config.lang);
      if (f.dataType !== 'enum') {
        var $input = $(action + '-im-threshold-value');
        $input.focus();
        $input.select();
      }
    }.bind(this));
  },

  /**
   * Renders the rename ruleset window in an overlay.
   * @param taskId ruleset id to rename.
   * @param taskName original name of the ruleset
   * @param taskDesc original description of the ruleset
   */
  renderRenameRulesetWindow: function (taskId, taskName, taskDesc) {
    // Locals
    var overlay = this.$UIStructurePainter.showOverlay();

    // Render
    overlay.grab(Mooml.render(
      'renameRulesetWindowTemplate',
      {
        i18n: this.i18n,
        taskId: taskId,
        taskName: taskName,
        taskDesc: taskDesc
      }
    ));

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();

    // Register event handlers for the new controls
    this.UIListener.registerTaskRenameEventHandlers();
    this.UIListener.registerOverlayEventHandlers();

    $('rename-task-input').select();
  },

  /**
   * Renders the rename task window in an overlay.
   * @param taskId Task id to rename.
   * @param taskName original name of the task
   */
  renderRenameTaskWindow: function (taskId, taskName) {
    // Locals
    var overlay = this.$UIStructurePainter.showOverlay();

    // Render
    overlay.grab(Mooml.render(
      'renameTaskWindowTemplate',
      {
        i18n: this.i18n,
        taskId: taskId,
        taskName: taskName
      }
    ));

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();

    // Register event handlers for the new controls
    this.UIListener.registerTaskRenameEventHandlers();
    this.UIListener.registerOverlayEventHandlers();

    $('rename-task-input').select();
  },

  renderExplanation: function (IM) {
    $$('#overlay .help span')[0].set('html', IM.getExplanation());
  },

  renderAddCoefficientWindow: function (field) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('addCoefficientWindowTemplate', {i18n: this.i18n, field: field}));
    var selectedCoefficient = this.ARBuilder.getFL().getDefaultBBACoef();
    var selectBox = $('add-coefficient-select');
    if (field.ref.choices.length === 1) {
      selectedCoefficient = this.ARBuilder.getFL().getBBACoefficients()['One category'];
      selectBox.grab(Mooml.render('addCoefficientWindowSelectOptionTemplate', {
        coefficient: selectedCoefficient,
        isSelected: true
      }));
    } else {
      Object.each(this.ARBuilder.getFL().getBBACoefficients(), function (BBACoefficient) {
        var isSelected = (BBACoefficient.getName() === selectedCoefficient.getName());
        selectBox.grab(Mooml.render('addCoefficientWindowSelectOptionTemplate', {
          coefficient: BBACoefficient,
          isSelected: isSelected
        }));
      }.bind(this));
    }
    this.renderAddCoefficientAutocomplete(field, selectedCoefficient);

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderEditCoefficientWindow: function (field) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('editCoefficientWindowTemplate', {i18n: this.i18n, field: field}));
    var selectedCoefficient = this.ARBuilder.getFL().getBBACoefficient(field.getType());
    var selectBox = $('edit-coefficient-select');
    if (field.ref.choices.length === 1) {
      selectedCoefficient = this.ARBuilder.getFL().getBBACoefficients()['One category'];
      selectBox.grab(Mooml.render('editCoefficientWindowSelectOptionTemplate', {
        coefficient: selectedCoefficient,
        isSelected: true
      }));
    } else {
      Object.each(this.ARBuilder.getFL().getBBACoefficients(), function (BBACoefficient) {
        var isSelected = (BBACoefficient.getName() === selectedCoefficient.getName());
        selectBox.grab(Mooml.render('editCoefficientWindowSelectOptionTemplate', {
          coefficient: BBACoefficient,
          isSelected: isSelected
        }));
      }.bind(this));
    }
    this.renderEditCoefficientAutocomplete(field, selectedCoefficient);

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderClickAddAttributeWindow: function (field) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('clickAddAttributeWindowTemplate', {i18n: this.i18n}));
    $('click-add-attribute-select').focus();
    this.UIListener.registerClickAddAttributeFormEventHandler(field);
    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderAddCoefficientAutocomplete: function (field, selectedCoefficient) {
    var i18n = this.i18n;
    /*var selectBox = $('add-coefficient-select');
    selectBox.focus();
    if (field.ref.choices.length === 1) {
      selectedCoefficient = this.ARBuilder.getFL().getBBACoefficients()['One category'];
      selectBox.grab(Mooml.render('addCoefficientWindowSelectOptionTemplate', {
        coefficient: selectedCoefficient,
        isSelected: true
      }));
    } else {
      Object.each(this.ARBuilder.getFL().getBBACoefficients(), function (BBACoefficient) {
        var isSelected = (BBACoefficient.getName() === selectedCoefficient.getName());
        selectBox.grab(Mooml.render('addCoefficientWindowSelectOptionTemplate', {
          coefficient: BBACoefficient,
          isSelected: isSelected
        }));
      }.bind(this));
    }*/
    Mooml.render('addCoefficientWindowAutocompleteTemplate', {
      i18n: i18n,
      selectedCoefficient: selectedCoefficient
    }).replaces($('add-coefficient-autocomplete'));

    if (selectedCoefficient.getName() === 'One category') {
      var attributeId = field.ref.id;
      this.AttributeValuesManager.getAttributeValues({
        attributeId: field.ref.id,
        onSuccess: function (data) {
          var select = null;
          if (data.hasOwnProperty('length') && (data.length > 0)) {
            //some items loaded...
            if (data.length > 100) {
              //too many items - render datalist
              Mooml.render('addCoefficientWindowCategoryAutocompleteTemplate', {
                i18n: i18n,
                selectType: 'input'
              }).replaces($('add-coefficient-category-autocomplete'));
              select = $('add-coefficient-category-list');
            } else {
              //render select
              Mooml.render('addCoefficientWindowCategoryAutocompleteTemplate', {
                i18n: i18n,
                selectType: 'select'
              }).replaces($('add-coefficient-category-autocomplete'));
              select = $('add-coefficient-category');
            }
            //render options, enable submit
            if (select !== null) {
              Array.each(data, function (value) {
                select.grab(Mooml.render('optionTemplate', {value: value}));
              });
              var submit = $('add-coefficient-autocomplete-submit');
              submit.setProperty('disabled', false);
              submit.removeAttribute('disabled');
            }
          } else {
            Mooml.render('addCoefficientWindowCategoryAutocompleteTemplate', {
              i18n: i18n,
              error: i18n.translate('No values found. Please select another value type.')
            }).replaces($('add-coefficient-category-autocomplete'));
          }
        },
        onError: function () {
          //render error
          Mooml.render('addCoefficientWindowCategoryAutocompleteTemplate', {
            i18n: i18n,
            error: i18n.translate('Sorry, values load failed. Please select another value type.')
          }).replaces($('add-coefficient-category-autocomplete'));
        }
      });

    } else {
      if (selectedCoefficient.fields.minLength.hidden) {
        $('add-coefficient-minlength').set('value', selectedCoefficient.fields.minLength.minValue).set('type', 'hidden');
        $('add-coefficient-minlength-label').setStyles({display: 'none'});
        $('add-coefficient-minlength-slider').setStyles({display: 'none'});
      } else if (selectedCoefficient.fields.minLength.minValue < selectedCoefficient.fields.minLength.maxValue) {
        var coefData = selectedCoefficient.fields.minLength;
        var maxChoicesExceeded = (coefData.maxValue > field.getRef().getNumChoices());
        var slider1 = new CoefficientAddSlider($('add-coefficient-minlength-slider'), $('add-coefficient-minlength'), coefData.minValue, coefData.minValueInclusive, maxChoicesExceeded ? field.getRef().getNumChoices() : coefData.maxValue, maxChoicesExceeded ? true : coefData.maxValueInclusive);
      } else {
        $('add-coefficient-minlength').set('value', selectedCoefficient.fields.minLength.minValue);
        $('add-coefficient-minlength-slider').setStyles({display: 'none'});
      }

      if (selectedCoefficient.fields.maxLength.hidden) {
        $('add-coefficient-maxlength').set('value', selectedCoefficient.fields.maxLength.minValue).set('type', 'hidden');
        $('add-coefficient-maxlength-label').setStyles({display: 'none'});
        $('add-coefficient-maxlength-slider').setStyles({display: 'none'});
      } else if (selectedCoefficient.fields.maxLength.minValue < selectedCoefficient.fields.maxLength.maxValue) {
        var coefData = selectedCoefficient.fields.maxLength;
        var maxChoicesExceeded = (coefData.maxValue > field.getRef().getNumChoices());
        var slider2 = new CoefficientAddSlider($('add-coefficient-maxlength-slider'), $('add-coefficient-maxlength'), coefData.minValue, coefData.minValueInclusive, maxChoicesExceeded ? field.getRef().getNumChoices() : coefData.maxValue, maxChoicesExceeded ? true : coefData.maxValueInclusive);
      } else {
        $('add-coefficient-maxlength').set('value', selectedCoefficient.fields.maxLength.minValue);
        $('add-coefficient-maxlength-slider').setStyles({display: 'none'});
      }

      if (slider1 && slider2) {
        slider1.setNextSlider(slider2);
        slider2.setPreviousSlider(slider1);
      }
    }

    this.renderExplanation(selectedCoefficient);
    this.UIListener.registerAddCoefficientFormEventHandler(field);
  },

  renderEditCoefficientAutocomplete: function (field, selectedCoefficient) {
    var i18n = this.i18n;

    Mooml.render('editCoefficientWindowAutocompleteTemplate', {
      field: field,
      i18n: i18n,
      selectedCoefficient: selectedCoefficient
    }).replaces($('edit-coefficient-autocomplete'));

    if (selectedCoefficient.getName() === 'One category') {
      //region render value selection
      var attributeId = field.ref.id;
      this.AttributeValuesManager.getAttributeValues({
        attributeId: field.ref.id,
        onSuccess: function (data) {
          var select = null;
          if (data.hasOwnProperty('length') && (data.length > 0)) {
            //some items loaded...
            if (data.length > 100) {
              //too many items - render datalist
              Mooml.render('editCoefficientWindowCategoryAutocompleteTemplate', {
                i18n: i18n,
                selectType: 'input'
              }).replaces($('edit-coefficient-category-autocomplete'));
              select = $('edit-coefficient-category-list');
            } else {
              //render select
              Mooml.render('editCoefficientWindowCategoryAutocompleteTemplate', {
                i18n: i18n,
                selectType: 'select'
              }).replaces($('edit-coefficient-category-autocomplete'));
              select = $('edit-coefficient-category');
            }
            //render options, enable submit
            if (select !== null) {
              Array.each(data, function (value) {
                select.grab(Mooml.render('optionTemplate', {value: value, isSelected: (field.category == value)}));
              });
              var submit = $('edit-coefficient-autocomplete-submit');
              submit.setProperty('disabled', false);
              submit.removeAttribute('disabled');
            }
          } else {
            Mooml.render('editCoefficientWindowCategoryAutocompleteTemplate', {
              i18n: i18n,
              error: i18n.translate('No values found. Please select another value type.')
            }).replaces($('edit-coefficient-category-autocomplete'));
          }
        },
        onError: function () {
          //render error
          Mooml.render('editCoefficientWindowCategoryAutocompleteTemplate', {
            i18n: i18n,
            error: i18n.translate('Sorry, values load failed. Please select another value type.')
          }).replaces($('edit-coefficient-category-autocomplete'));
        }
      });
      //endregion render value selection
    } else {
      if (selectedCoefficient.fields.minLength.hidden) {
        $('edit-coefficient-minlength').set('value', selectedCoefficient.fields.minLength.minValue).set('type', 'hidden');
        $('edit-coefficient-minlength-label').setStyles({display: 'none'});
        $('edit-coefficient-minlength-slider').setStyles({display: 'none'});
      } else if (selectedCoefficient.fields.minLength.minValue < selectedCoefficient.fields.minLength.maxValue) {
        var coefData = selectedCoefficient.fields.minLength;
        var maxChoicesExceeded = (coefData.maxValue > field.getRef().getNumChoices());
        var slider1 = new CoefficientEditSlider($('edit-coefficient-minlength-slider'), $('edit-coefficient-minlength'), coefData.minValue, coefData.minValueInclusive, maxChoicesExceeded ? field.getRef().getNumChoices() : coefData.maxValue, maxChoicesExceeded ? true : coefData.maxValueInclusive);
      } else {
        $('edit-coefficient-minlength').set('value', selectedCoefficient.fields.minLength.minValue);
        $('edit-coefficient-minlength-slider').setStyles({display: 'none'});
      }
      if (selectedCoefficient.fields.maxLength.hidden) {
        $('edit-coefficient-maxlength').set('value', selectedCoefficient.fields.maxLength.minValue).set('type', 'hidden');
        $('edit-coefficient-maxlength-label').setStyles({display: 'none'});
        $('edit-coefficient-maxlength-slider').setStyles({display: 'none'});
      } else if (selectedCoefficient.fields.maxLength.minValue < selectedCoefficient.fields.maxLength.maxValue) {
        var coefData = selectedCoefficient.fields.maxLength;
        var maxChoicesExceeded = (coefData.maxValue > field.getRef().getNumChoices());
        var slider2 = new CoefficientEditSlider($('edit-coefficient-maxlength-slider'), $('edit-coefficient-maxlength'), coefData.minValue, coefData.minValueInclusive, maxChoicesExceeded ? field.getRef().getNumChoices() : coefData.maxValue, maxChoicesExceeded ? true : coefData.maxValueInclusive);
      } else {
        $('edit-coefficient-maxlength').set('value', selectedCoefficient.fields.maxLength.minValue);
        $('edit-coefficient-maxlength-slider').setStyles({display: 'none'});
      }

      if (slider1 && slider2) {
        slider1.setNextSlider(slider2);
        slider2.setPreviousSlider(slider1);
      }
    }

    this.renderExplanation(selectedCoefficient);
    this.UIListener.registerEditCoefficientFormEventHandler(field);
    this.UIListener.registerOverlayEventHandlers();
  },

  renderEditConnectiveWindow: function (cedent) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('editConnectiveWindowTemplate', {i18n: this.i18n}));
    if (this.ARBuilder.getFL().isConnectiveAllowed('Conjunction', cedent.getScope(), this.ARBuilder.getARManager().getActiveRule().toSettings()[cedent.getScope()], cedent.getLevel())) {
      $('edit-connective-select').grab(Mooml.render('editConnectiveWindowSelectOptionTemplate', {
        isSelected: cedent.getConnective().getName() === 'Conjunction',
        connective: 'Conjunction'
      }));
    }

    if (this.ARBuilder.getFL().isConnectiveAllowed('Disjunction', cedent.getScope(), this.ARBuilder.getARManager().getActiveRule().toSettings()[cedent.getScope()], cedent.getLevel())) {
      $('edit-connective-select').grab(Mooml.render('editConnectiveWindowSelectOptionTemplate', {
        isSelected: cedent.getConnective().getName() === 'Disjunction',
        connective: 'Disjunction'
      }));
    }

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();

    this.UIListener.registerEditConnectiveFormEventHandler(cedent);
    this.UIListener.registerOverlayEventHandlers();
  },

  renderCreateUserReportWindow: function () {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('createUserReportWindowTemplate', {
      i18n: this.i18n,
      url: this.config.getCreateUserReportUrl()
    }));

    this.UIListener.registerOverlayEventHandlers();

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  /**
   * Funkce pro samostatné vykreslení jednoho nalezeného pravidla
   * @param foundRule
   */
  updateFoundRule: function (foundRule) {
    var foundRuleElement = $(foundRule.getCSSID());
    if (!foundRuleElement) {
      return;
    }

    Mooml.render('foundRuleTemplate', {
      IMs: this.ARBuilder.$FRManager.IMs,
      foundRule: foundRule,
      i18n: this.i18n
    }).replaces(foundRuleElement);

    this.UIListener.registerFoundRuleEventHandlers(foundRule);
  },

  renderExportBusinessRulesDialog: function (taskId, rules) {
    var rulesIds = [];
    rules.each(function (rule) {
      rulesIds.push(rule.getRule().getId());
    });

    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('exportBusinessRulesDialogTemplate', {
      i18n: this.i18n,
      url: this.config.getExportBusinessRulesUrl(taskId, rulesIds)
    }))

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderRuleDetailsDialog: function (taskId, ruleId) {
    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('showRuleDetailsDialogTemplate', {
      i18n: this.i18n,
      url: this.config.getRuleDetailsUrl(taskId, ruleId)
    }));
    this.UIListener.registerOverlayEventHandlers();
    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  renderModelTesterDialog: function (taskId, rules) {
    var rulesIds = [];
    rules.each(function (rule) {
      rulesIds.push(rule.getRule().getId());
    });

    var overlay = this.$UIStructurePainter.showOverlay();
    overlay.grab(Mooml.render('modelTesterDialogTemplate', {
      i18n: this.i18n,
      url: this.config.getModelTesterUrl(taskId, rulesIds)
    }))

    // Positioning of Overlay after rendering
    this.$UIStructurePainter.posOverlay();
  },

  //region FoundRules
  renderFoundRules: function (data) {
    Mooml.render(
      'foundRulesStructureTemplate',
      {
        i18n: this.i18n,
        FRManager: this.ARBuilder.$FRManager,
        UIListener: this.UIListener
      }
    ).replaces($('found-rules'));

    var foundRules = this.ARBuilder.$FRManager.rules;
    Array.each(foundRules, function (foundRule) {
      this.UIListener.registerFoundRuleEventHandlers(foundRule);
    }.bind(this));

    this.UIListener.registerFoundRulesEventHandlers(this.ARBuilder.$FRManager);
    this.UIListener.registerFoundRulesMultiControlsEventHandlers();

    ///this.$UIStructurePainter.resizeApplication();
  },
  //endregion FoundRules

  /* navigation */
  showETreeProgress: function () {
    $('etree-progress').fade('in');
  },

  hideETReeProgress: function () {
    $('etree-progress').fade('out');
  },

  morph: function (el, options, duration) {
    duration = duration || this.morphDuration;
    el.set('morph', {duration: duration});
    el.morph(options);
  },

  hideOverlay: function () {
    this.$UIStructurePainter.hideOverlay();
  },

  /**
   * Updates the overlay window css position.
   * @param isFixed True if the window should be fixed, false otherwise.
   */
  updateOverlayPosition: function (isFixed) {
    // var overlay = $('overlay');
    // var newHeight = null;
    //
    // // Change the position and size
    // if (isFixed) {
    //   overlay.setStyle('height', this.overlayHeight);
    //   $('settings-window').setStyle('margin-top', this.settingsWindowTopMargin);
    //   overlay.setStyle('position', 'fixed');
    // } else {
    //   this.overlayHeight = overlay.getStyle('height');
    //   this.settingsWindowTopMargin = $('settings-window').getStyle('margin-top');
    //
    //   newHeight = $$('body').getStyle('height');
    //   overlay.setStyles({
    //     height: newHeight,
    //     position: 'absolute'
    //   });
    //   $('settings-window').setStyle('margin-top', '10px');
    // }
  },

  renderCurrentUserWarning: function (message, url) {
    var overlay = this.$UIStructurePainter.showOverlay();
    var window = Mooml.render('userWarningWindowTemplate', {message: message, url: url});
    overlay.grab(window);
    this.$UIStructurePainter.posOverlay();
  }

});