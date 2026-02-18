let scrollPos = 0;            // used to restore the scroll position after a re-render
let milestoneMap = {};        // quicker lookups of milestones from ID
let categoryMap = {};         // quicker lookups of categories from code
let resourceMap = {};         // quicker lookups of categories from code
let taskMap = {};             // quicker lookups of tasks from ID
let showCompleted = false;    // enables the rendering of completed tasks
let unsavedChanges = false;   // used to know if something has been edited and so the save button should be active and a warning on page close
const readOnlyMode = false;
const activeFilters = { categories: new Set(), milestones: new Set(), searchText: "", dateAfter: null, dateBefore: null, excludePerpetual: false }; // tracks active filters

// --------------------------------------------------- //
//  HELPER FUNCTIONS
// --------------------------------------------------- //

// returns true if the input date string is in the past (compared to today) - doesn't check for validity
function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // normalize to right on midnight tonight
  const due = new Date(dateStr);
  return due < today;
}
// returns true if the input date string is in the coming week (compared to today) - doesn't check for validity
function isSoon(dateStr) {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // normalize to right on midnight tonight
  const due = new Date(dateStr);
  return (due - today)/1000 <= ((USERDATA.config.soon_duration || 7) * 24 * 60 * 60);
}
// returns today's date as a string in format "YYYY-MM-DD"
function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
// converts a string into a ID attribute suitable string
function createHtmlIdFromString(str) {
  return String(str)
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("(", "")
    .replaceAll(",", "")
    .replaceAll(")", "")
    .replaceAll(":", "");
}
// returns now as a string in format "YYYY-MM-DD HH:MM"
function nowString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const hour = String(today.getHours()).padStart(2, '0');
    const minute = String(today.getMinutes()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day} ${hour}:${minute}`; // Example: YYYY-MM-DD HH:MM
    return formattedDate;

}

// --------------------------------------------------- //
//  USER DATA MANIPULATION FUNCTIONS
// --------------------------------------------------- //

// returns the color code for a category from the category code
function colorFromCategoryCode(code){
  if (code==null) return '';
  categoryWithCode = categoryMap[code.toLowerCase()]; //USERDATA.categories.find(c => c.code.toLowerCase() === code.toLowerCase());
  if (categoryWithCode) { return categoryWithCode.color; }
  return 'default';
}
// returns the name of a category from a category code
function nameFromCategoryCode(code){
  if (code==null) return 'No Category';
  categoryWithCode = categoryMap[code.toLowerCase()]; //USERDATA.categories.find(c => c.code.toLowerCase() === code.toLowerCase());
  if (categoryWithCode) { return categoryWithCode.name; }
  return 'Undefined Category';
}
// returns a matching milestone by ID, or null
function milestoneFromId(id) {
  return milestoneMap[id] || null;
}
// returns a matching task by ID, or null
function taskFromId(id) {
  return taskMap[id] || null;
}
// returns unique milestone id for creating a new one
function generateUniqueMilestoneId() {
  return USERDATA.milestones.length > 0
    ? Math.max(...USERDATA.milestones.map(m => m.id)) + 1
    : 1;
}
// returns unique task id for creating a new one
function generateUniqueTaskId() {
  return USERDATA.tasks.length > 0
    ? Math.max(...USERDATA.tasks.map(t => t.id)) + 1
    : 1;
}
// returns unique mielstone id for creating a new one
function generateUniqueMilestoneId() {
  return USERDATA.milestones.length > 0
    ? Math.max(...USERDATA.milestones.map(t => t.id)) + 1
    : 1;
}
// updates task activeness and priority from DOM location on page (allocation is done on drag or on edit)
function updateTaskPriorityFromPage(){
  console.log("PRIORITY: Updating priority / active status from DOM.")
  let counter = 1;
  $(".task-list").each(function(index, taskList) {
    $(taskList).find('.task').each(function(index, taskEl) {
      taskId = Number($(taskEl).attr("data-itemid"));
      task = taskMap[taskId];
      if (task){
        task.priority = counter;
        task.active = $(taskList).hasClass("tasks-active")
        counter += 1;
      }
    })
  })
}
// ised with filter clause to reduse task list to matches of the active filters
function matchesActiveFilters(task) {
  
  // Category
  if (activeFilters.categories.size > 0) {
    if (!task.category || !activeFilters.categories.has(task.category.toLowerCase())) return false;
  }

  // Milestone
  if (activeFilters.milestones.size > 0) {
    const matchesMs = activeFilters.milestones.has(String(task.milestoneId));
    if (!matchesMs) return false;
  }

  // Text match (case-insensitive) against task text OR milestone name
  if (activeFilters.searchText && activeFilters.searchText.trim() !== "") {
    const needle = activeFilters.searchText.trim().toLowerCase();
    const taskText = (task.text || "").toLowerCase();
    let msName = "";
    if (task.milestoneId) {
      const ms = milestoneMap[task.milestoneId];
      if (ms) msName = (ms.name || "").toLowerCase();
    }
    if (!taskText.includes(needle) && !msName.includes(needle)) return false;
  }

  if (activeFilters.dateAfter) {
    // perpetual (including linked milestones aren't filtered out)
    if (task.milestoneId) { // driven by milestone
      const ms = milestoneFromId(task.milestoneId);
      if (ms) { if (ms.date && ms.date < activeFilters.dateAfter) { return false } } // milestone date exists and is before minimum date 
    } 
    else if (task.date && task.date < activeFilters.dateAfter) { return false } // direct date exists and is before minimum date
  }

  if (activeFilters.dateBefore) {
    // perpetual (including linked milestones aren't filtered out)
    if (task.milestoneId) { // driven by milestone
      const ms = milestoneFromId(task.milestoneId);
      if (ms) { if (ms.date && ms.date > activeFilters.dateBefore) { return false } } // milestone date exists and is after maximum date 
    } 
    else if (task.date && task.date > activeFilters.dateBefore) { return false } // direct date exists and is after maximum date
  }

  if (activeFilters.excludePerpetual){
    if (!task.date){
      if (!task.milestoneId) { return false } // no date and no milestone indicated
      else {
        const ms = milestoneFromId(task.milestoneId);
        if (!ms) { return false } // linked milestone not found
        else {
          if (!ms.date) { return false } // no date on linked milestone
        }
      }
    }
  }

  return true;
}
// this function exports userdata to a JSON file (button in configuration section)
function exportUserData(filename = "USERDATA.json") {
  try {
    const jsonString = JSON.stringify(USERDATA, null, 2); // pretty print
    const blob = new Blob([jsonString], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("USERDATA exported");
    showToast('success', 'USERDATA Exported', "Data was saved to the JSON file.");
  } catch (err) {
    console.error("Export failed:", err);
  }
}
// this function imports userdata from a JSON file (button in configuration section)
function importUserData() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        reject("No file selected");
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          USERDATA = json; // override variable
          console.log("USERDATA imported:", USERDATA);
          resolve(USERDATA);
          updatePage();
          showToast('success', 'USERDATA Imported', "Data was replaced with the data from the JSON file.");
        } catch (err) {
          reject("Invalid JSON file");
        }
      };

      reader.onerror = () => reject("Error reading file");
      reader.readAsText(file);
    };

    input.click();
  });
}

// --------------------------------------------------- //
//  DOM RENDERING FUNCTIONS + HELPERS/TEMPLATES
// --------------------------------------------------- //

function setChangesPresent(changes){  
  $("button#button-save").prop("disabled", !changes)
  $("button#button-save-read-only").prop("disabled", changes)
  $("button#button-export-clipboard").prop("disabled", changes)
  if (changes){ $("button#button-save").addClass("btn-primary ").removeClass("btn-secondary")
  }      else { $("button#button-save").addClass("btn-secondary").removeClass("btn-primary ") }
  unsavedChanges = changes;

}
// clears all data from the DOM (useful for reset/saving)
function sanitizeDOM(){
  $(".count").text("X");
  $("#milestone-list").html("");
  $("#allocations-list").html("");
  $("#completed-task-list").html("");
  $("#milestoneTimeline").html("");
  $("#milestoneTimelineNote").html("");
  $("#dialog-task-timeline .timeline-holder").html("");
  $("#dialog-task-timeline .timeline-holderNote").html("");
  $("#menu-allocations-list").html("");
  $(document).prop('title', "Project Title");
  $("#heading-title").text("Project Title");
  $("#heading-logo").html("");
  $('head').find('link[rel="icon"], link[rel="shortcut icon"]').remove();
  $('select:not(.preserve)').html("");
  $('#alert-delete-task-name, #alert-complete-task-name').text("");
  $('input').val("");
  $('textarea').val("");

  cln = $('.select-multiple-categories').clone().removeAttr("data-select-initialized");
  cln.find('[role="listbox"]').html("");
  $('.select-multiple-categories').replaceWith(cln);

  cln = $('.select-multiple-milestones').clone().removeAttr("data-select-initialized");
  cln.find('[role="listbox"]').html("");
  $('.select-multiple-milestones').replaceWith(cln);

  $('#last-saved').text("");
  $(".editable-resource-entry:not(.hidden)").remove();
  $(".editable-category-entry:not(.hidden)").remove();
  // reset this button text
  $('button.show-completed-tasks').text("Show Completed Task List");    
  $("#old-task-deletion-group").addClass("hidden");  
  $("#active-filter-string").html("");
}
// this renders a timeline into the DOM and returns the handle for it
function renderTimeline(selector, data, callbackfn){
  return window.milestonesViz(selector)
    .mapping({
      timestamp: "date",
      text: "title"
    })
    .parseTime("%Y-%m-%d")
    .aggregateBy('day')
    .labelFormat("%b %d")
    .optimize(true)
    .render(data)
    .renderCallback(callbackfn);
}
// renders the UI select dropdowns allowing selection of categories, resources and milestones
function renderDropdowns() {

  let optionsArr = []
  USERDATA.resources.forEach(r => {
    optionsArr.push($('<option>', { value: r.name}).text(`${r.name} - ${r.type}`))
  });
  optionsArr.push($('<option>', { value: ""}).text("- UNALLOCATED -"));
  $('select.select-resources').html("").append(optionsArr);

  optionsArr = []
  optionsArr.push($('<option>', { value: ""}).text("- NO MILESTONE -"));
  USERDATA.milestones.forEach(m => {
    optionsArr.push($('<option>', { value: m.id}).text(m.name));
  });
  $("select.select-milestone").html("").append(optionsArr);

  optionsArr = []
  optionsArr.push($('<option>', { value: ""}).text("- NO CATEGORY -"));
  USERDATA.categories.forEach(c => {
    optionsArr.push($('<option>', { value: c.code}).text(c.name));
  });
  $("select.select-category").html("").append(optionsArr);

  // multi-selects for filter:

  optionsArr = []
  USERDATA.categories.forEach(c => {
    optionsArr.push($('<div>', { role: "option", "data-value": c.code.toLowerCase(), "data-label": c.name}).html(`<span>${c.name}</span>`));
  });
  cln = $('.select-multiple-categories').clone().removeAttr("data-select-initialized");
  cln.find('[role="listbox"]').html("").append(optionsArr);
  $('.select-multiple-categories').replaceWith(cln);

  optionsArr = []
  USERDATA.milestones.forEach(m => {
    optionsArr.push($('<div>', { role: "option", "data-value": m.id, "data-label": m.name}).html(`<span>${m.name}</span>`));
  });
  cln = $('.select-multiple-milestones').clone().removeAttr("data-select-initialized");
  cln.find('[role="listbox"]').html("").append(optionsArr);
  $('.select-multiple-milestones').replaceWith(cln);

}
// renders the active filter string and shows the overlay. Also updates the clear button availability
function renderActiveFilterStringAndButtonState() {
  const parts = [];

  // (optional) text search
  if (String(activeFilters.searchText).trim() !== "") {
    parts.push(`<strong>Contains text</strong> "${String(activeFilters.searchText).trim()}"`);
  }

  // categories
  if (activeFilters.categories.size > 0) {
    const names = [...activeFilters.categories].map(code => {
      const c = categoryMap[code];
      return c ? c.name : code;
    });
    parts.push(`<strong>Category IN</strong> [${names.join(", ")}]`);
  }

  // milestones
  if (activeFilters.milestones.size > 0) {
    const names = [...activeFilters.milestones].map(idStr => {      
      const ms = milestoneMap[Number(idStr)];
      return ms ? ms.name : `Milestone ${idStr}`;
    });
    parts.push(`<strong>Milestone IN</strong> [${names.join(", ")}]`);
  }

  if (activeFilters.dateAfter && !activeFilters.dateBefore){
    parts.push(`Task (or Milestone) <strong>date AFTER</strong> or on '${activeFilters.dateAfter}'`);
  }
  else if (activeFilters.dateBefore && !activeFilters.dateAfter){
    parts.push(`Task (or Milestone) <strong>date BEFORE</strong> or on '${activeFilters.dateBefore}'`);
  }
  else if (activeFilters.dateBefore && activeFilters.dateAfter){
    parts.push(`Task (or Milestone) <strong>date BETWEEN</strong> or on '${activeFilters.dateAfter}' and '${activeFilters.dateBefore}'`);
  }

  if (activeFilters.excludePerpetual){
    parts.push(`Task (or Milestone) is <strong>not PERPETUAL</strong> or undated.`);
  }

  if (parts.length === 0) {
    $("#active-filter-string").parent().addClass("hidden");
    $("button#button-filter-clear").prop("disabled", true).addClass("btn-secondary").removeClass("btn-primary");
    $("#active-filter-string").html("No active filters. Showing all tasks.");
  }else{
    $("#active-filter-string").parent().removeClass("hidden");    
    $("button#button-filter-clear").prop("disabled", false).addClass("btn-primary").removeClass("btn-secondary");
    $("#active-filter-string").html("<strong>ACTIVE TASK FILTERS:</strong><br /><ul><li class='ms-5'>" + parts.join(" <strong>AND</strong> </li><li class='ms-5'>") + "</li></ul>");
  }
}
// this shows a temporary 'taost' popup notifaction
function showToast(cat, title, description){
  console.log("TOAST:", $("<div>").html(description).text());
  document.dispatchEvent(new CustomEvent('basecoat:toast', {
    detail: {
      config: { category: cat, title: title,
        description: description
      }
    }
  }));
}
// this does the calling of the rendering functions (page wide)
function updatePage(){

  // console.group("updatePage()")

  console.log("EVENT: Page update triggered")
  // Save scroll position
  scrollPos = window.scrollY

  milestoneMap = Object.fromEntries(USERDATA.milestones.map(m => [m.id, m]));
  categoryMap = Object.fromEntries(USERDATA.categories.map(c => [c.code.toLowerCase(), c]));
  resourceMap = Object.fromEntries(USERDATA.resources.map(r => [r.name.toLowerCase(), r]));
  taskMap = Object.fromEntries(USERDATA.tasks.map(c => [c.id, c]));

  sanitizeDOM();

  if (readOnlyMode && !USERDATA.config.title.startsWith("[READONLY] ")){ USERDATA.config.title = "[READONLY] " + USERDATA.config.title }
  $(document).prop('title', USERDATA.config.title);
  $("#heading-title").text(USERDATA.config.title);
  $("#heading-logo").html(USERDATA.config.logo);
  $('#last-saved').text(USERDATA.config.last_saved);
  $(':root').css('--primary', USERDATA.config.primary_color);

  // encode and set svg as favicon
  var encoded = 'data:image/svg+xml,' + encodeURIComponent(USERDATA.config.logo).replace(/'/g, "%27").replace(/"/g, "%22");
  $('<link>', { rel: 'icon', type: 'image/svg+xml', href: encoded }).appendTo('head');

  renderMilestoneList();
  renderMilestoneTimeline();
  renderResources();
  addRemoveDropzones();
  renderCompletedTasks();
  renderDropdowns();
  if (!readOnlyMode){
    enableDragging();
  }
  renderActiveFilterStringAndButtonState();
  if (readOnlyMode){
    $(".edit-task, .edit-milestone").parent().hide(); // hides the modifying milestone and task icons
    $("#configurations-menu").closest("div").hide(); // hides the config menu
    $("#button-save").closest(".button-group").hide(); // hides the save controls
    $(".add-task, .add-milestone, #old-task-deletion-group").hide(); // hides add and delete-complete buttons
  }


  // Restore scroll position
  window.scrollTo({ top:scrollPos, left:0, behavior: "instant"})

  setChangesPresent(true);
  // console.groupEnd()

}
// This does some initial setup, triggers the render and sets up delegated onclick events for buttons and icons
$( document ).ready(function() {

  console.log("EVENT: Document Ready");

  themeChanger();
  scaleChanger();

  updatePage(); // first render
  setChangesPresent(false);

  // INITIALISATION
  const $root = $('#container');
  $root.off('.app');

  // Prevent hash in URL
  $(window).on('hashchange', function(e){ window.history.pushState("", document.title, window.location.pathname); })

  // delegated event handlers - for performance
  $("main").on('click', 'div.edit-task', function(){
    taskId = Number($(this).closest('.task').attr("data-itemid"));
    setupAndShowEditTaskModal(taskId);
  });
  $("main").on('click', 'div.edit-milestone', function(){
    milestoneId = Number($(this).closest('.milestone').attr("data-itemid"));
    setupAndShowEditMilestoneModal(milestoneId);
  });
  $("main").on('click', 'div.toggle-milstone-tentative', function(){
    if (!readOnlyMode){
      milestoneId = Number($(this).closest('.milestone').attr("data-itemid"));
      toggleMilestoneTentative(milestoneId);
    }
  });
  $("main").on('click', 'div.delete-milestone', function(){
    milestoneId = Number($(this).closest('.milestone').attr("data-itemid"));
    askMilestoneDeletion(milestoneId);
  });
  $("main").on('click', 'div.complete-task', function(){
    taskId = Number($(this).closest('.task').attr("data-itemid"));
    toggleTaskCompletion(taskId);
  });
  $("main").on('click', 'div.delete-task', function(){
    taskId = Number($(this).closest('.task').attr("data-itemid"));
    askTaskDeletion(taskId);
  });  
  $("main").on('click', 'button#remove-complete-tasks-button', function(){
    askDeleteCompleteTasksBefore();    
  });
  $("main").on('click', 'button.timeline', function(){
    resourceId = $(this).attr("data-resource-id");
    showResourceTimeline(resourceId);
  });
  $("main").on('click', 'button.add-task', function(){
    resourceId = $(this).attr("data-resource-id");
    setupAndShowAddTaskModal(resourceId);
  });
  $("main").on('click', 'button.show-completed-tasks', function(){
    showCompleted = !showCompleted;    
    renderCompletedTasks();
  });
  $("body").on('click', '#alert-complete-task button.confirm', function(){
    id = Number($("#alert-complete-task button.confirm").attr("data-task-id"));
    setTaskComplete(id);
    $('#alert-complete-task').get(0).close();
  });
  $("body").on('click', '#alert-delete-task button.confirm', function(){
    id = Number($("#alert-delete-task button.confirm").attr("data-task-id"));
    deleteTask(id);
    $('#alert-delete-task').get(0).close();
  });
  $("body").on('click', '#alert-delete-milestone button.confirm', function(){
    id = Number($("#alert-delete-milestone button.confirm").attr("data-task-id"));
    deleteMilestone(id);
    $('#alert-delete-milestone').get(0).close();
  });
  $("body").on('click', '#alert-delete-completed-tasks button.confirm', function(){
    deleteCompleteTasksBefore();
    $('#alert-delete-completed-tasks').get(0).close();
  });
  $("body").on('click', '#dialog-configure-resources button.stage-resource-deletion', function(){
    $(this).parents(".editable-resource-entry").toggleClass("opacity-25");
    $(this).toggleClass("btn-destructive text-red-600");
  });
  $("body").on('click', '#dialog-configure-resources button.add-resource-div', function(){
    tmplt = $('#dialog-configure-resources .editable-resource-entry.hidden');
    resDiv = tmplt.clone().removeClass("hidden");    
    resDiv.appendTo($(tmplt).parent())
  });  

   $("body").on('change', 'select.category-color', function(){
    $(this).css("color", $(this).val());
  });
  $("body").on('click', '#dialog-configure-categories button.stage-category-deletion', function(){
    $(this).parents(".editable-category-entry").toggleClass("opacity-25");
    $(this).toggleClass("btn-destructive text-red-600");
  });
  $("body").on('click', '#dialog-configure-categories button.add-category-div', function(){
    tmplt = $('#dialog-configure-categories .editable-category-entry.hidden');
    catDiv = tmplt.clone().removeClass("hidden");    
    catDiv.appendTo($(tmplt).parent())
  });

  $("body").on('click', 'button#import-json', function(){
    importUserData()
      .then(data => {console.log("Loaded:", data);})
      .catch(err => console.error(err));    
  });
  $("body").on('click', 'button#export-json', function(){
    exportUserData();
  });
 

})

// ELEMENT CREATION FUNCTIONS --------------------------

// this creates a milestone list item and returns it - called by renderMilestoneList()
function createMilestoneElement(ms){

  template = document.getElementById('template-milestone');
  clone = template.content.cloneNode(true);
  let msDiv = $(clone).find('.milestone');
  msDiv.attr({"data-itemid": ms.id});
  msDiv.find(".milestoneName").text(ms.name);

  if (ms.date) { // driven by date
    msDiv.find(".date").text(ms.date);
    if (isPastDate(ms.date)) msDiv.find(".date").addClass("text-red-500");
    else if (isSoon(ms.date)) msDiv.find(".date").addClass("text-yellow-500");

    if (ms.tentative) { msDiv.find("svg.tentative").removeClass("opacity-10").addClass("opacity-50") }
    else { msDiv.find("svg.tentative").removeClass("opacity-50").addClass("opacity-10") }

  }
  else {  // perpetual
    msDiv.find(".date").addClass("opacity-70").text("PERPETUAL");
  }

  if (ms.link) {
    msDiv.find("svg.link")
      .removeClass("text-sky-500/10 cursor-not-allowed").addClass("text-sky-500/70 hover:text-sky-500 cursor-pointer")
      .wrap(`<a href='${ms.link}' target='_blank'></a>`); }
  else { msDiv.find("svg.link").addClass("text-sky-500/20").removeClass("text-sky-500/70 hover:text-sky-500 cursor-pointer").parent().removeAttr("data-tooltip") }

  return msDiv

}
// this creates a task list item and returns it - called by renderResources() and renderCompletedTasks()
function createTaskElement(t){
  template = document.getElementById('template-task');
  clone = template.content.cloneNode(true);
  let taskDiv = $(clone).find('.task');
  taskDiv.attr({"data-itemid": t.id});
  taskDiv.find(".taskName").text(t.text);
  taskDiv.find(".category").css({"color": colorFromCategoryCode(t.category)}).text(t.category||"---").attr("data-tooltip", nameFromCategoryCode(t.category));

  if (t.milestoneId) { // driven by milestone
    const ms = milestoneFromId(t.milestoneId);
    if (ms) {
      taskDiv.find(".task-milestone .name").text(ms.name);
      if (ms.date) { taskDiv.find(".task-milestone .date").text(ms.date); }
      else { taskDiv.find(".task-milestone .date").addClass("opacity-70").text("PERPETUAL");}
      if (ms.tentative){ taskDiv.find(".task-milestone .tentative").removeClass("opacity-0"); }
      if (ms.date) {
        if (isPastDate(ms.date)) taskDiv.find(".task-milestone .date").addClass("text-red-500");
        else if (isSoon(ms.date)) taskDiv.find(".task-milestone .date").addClass("text-yellow-500");
      }
    }
  } else if (t.date) { // driven by date
    taskDiv.find(".task-milestone .name").addClass("hidden");
    taskDiv.find(".task-milestone .date").text(t.date);
    if (isPastDate(t.date)) taskDiv.find(".task-milestone .date").addClass("text-red-500");
    else if (isSoon(t.date)) taskDiv.find(".task-milestone .date").addClass("text-yellow-500");
  }
  else {  // perpetual
    taskDiv.find(".task-milestone .name").addClass("hidden");
    taskDiv.find(".task-milestone .date").addClass("opacity-70").text("PERPETUAL");
  }

  taskDiv.find(".allocation .assignee").text(t.assignedTo || "Unallocated");
  if (t.completed){
    taskDiv.find(".allocation").removeClass("hidden");
    taskDiv.find(".complete-task").attr("data-tooltip", "Mark task NOT complete");
    taskDiv.find(".complete-task svg").removeClass("text-green-600/20").addClass("text-green-600/80");

    if (t.completed != true){
      taskDiv.find(".completed-date").removeClass("hidden");
      taskDiv.find(".completed-date span").text(t.completed);
    }
  }

  if (t.linkConf) {
    taskDiv.find("svg.confluence")
      .removeClass("text-sky-500/10 cursor-not-allowed").addClass("text-sky-500/70 hover:text-sky-500 cursor-pointer")
      .wrap(`<a href='${t.linkConf}' target='_blank'></a>`); }
  else { taskDiv.find("svg.confluence").addClass("text-sky-500/20").removeClass("text-sky-500/70 hover:text-sky-500 cursor-pointer").parent().removeAttr("data-tooltip") }

  if (t.linkJira) {
    taskDiv.find("svg.jira")
      .removeClass("text-sky-500/10 cursor-not-allowed").addClass("text-sky-500/70 hover:text-sky-500 cursor-pointer")
      .wrap(`<a href='${t.linkJira}' target='_blank'></a>`); }
  else { taskDiv.find("svg.jira").addClass("text-sky-500/20").removeClass("text-sky-500/70 hover:text-sky-500 cursor-pointer").parent().removeAttr("data-tooltip") }

  if (t.linkOther) {
    taskDiv.find("svg.link")
      .removeClass("text-sky-500/10 cursor-not-allowed").addClass("text-sky-500/70 hover:text-sky-500 cursor-pointer")
      .wrap(`<a href='${t.linkOther}' target='_blank'></a>`); }
  else { taskDiv.find("svg.link").addClass("text-sky-500/20").removeClass("text-sky-500/70 hover:text-sky-500 cursor-pointer").parent().removeAttr("data-tooltip") }

  return taskDiv

}

// MILESTONES SECTION -------------------------------

// this renders the milestone list into the DOM
function renderMilestoneList(){

  $("#ms-title .count").text(USERDATA.milestones.length);

  milestoneArr = [];
  USERDATA.milestones
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;      // undated milestones last
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    })
    .forEach(ms => { milestoneArr.push(createMilestoneElement(ms)); })
  $("section#milestones #milestone-list").append(milestoneArr);

}
// this derives the data and calls renderTimeline() to render milestone timeline into the DOM
function renderMilestoneTimeline() {
  const host = document.getElementById("milestoneTimeline");
  if (!host) return;

  // Only dated milestones make sense on a time scale
  const dated = USERDATA.milestones
    .filter(m => m && m.date)               // date is "YYYY-MM-DD" or ""
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // If none, hide the timeline area
  if (dated.length === 0) {
    host.innerHTML = "";
    host.style.display = "none";
    return;
  }
  host.style.display = "";

  // Map your milestone objects to what d3-milestones expects (timestamp + text)
  let data = dated.map(m => ({
    date: m.date,                 // keep original string
    title: m.name,                // keep label
    bulletStyle: m.tentative ? {
      "border-color": "var(--foreground);",
      "opacity": "0.5"
    } : undefined,
    textStyle: m.tentative ? {
      "color": "var(--foreground);",
      "border-color": "var(--foreground);",
      "opacity": "0.5",
      "font-style": "italic"
    } : undefined
  }));

  // --- Add a synthetic "Today" marker (red) ---
  const today = todayYMD();

  // Prevent duplicates if you already have a milestone dated today with the same label
  const hasToday = data.some(d => d.date === today && d.title === "Today");

  if (!hasToday) {
    data.push({
      date: today,
      title: "Today",
      textStyle: {"color": "red"}
    });
  }

  // keep timeline ordered
  data.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (USERDATA.config.force_timeline_start) {
    data = data.filter(m => m.date >= USERDATA.config.force_timeline_start);
    data.unshift({
      date: USERDATA.config.force_timeline_start,
      title: "Timeline Start",
      textStyle: { "opacity": "0.5" }
    })
  }
  if (USERDATA.config.force_timeline_end) {
    data = data.filter(m => m.date <= USERDATA.config.force_timeline_end);
    data.push({
      date: USERDATA.config.force_timeline_end,
      title: "Timeline End",
      textStyle: { "opacity": "0.5" }
    })
  }

  console.log("TIMELINE: Rendering Milestone timeline.")
  renderTimeline("section#milestones #milestoneTimeline", data, function () {
    $(".milestones-text-label").filter(function () {
      return $.trim($(this).text()) === "Today";
    }).parent().parent().parent().parent().addClass("milestone-vis-today");
  });
  if (USERDATA.config.force_timeline_start && USERDATA.config.force_timeline_end) { 
    $("#milestoneTimelineNote").text(`Timeline limited to dates on or after '${USERDATA.config.force_timeline_start}' and on or before '${USERDATA.config.force_timeline_end}'. Change this setting in General Configuration.`) 
  }
  else if (USERDATA.config.force_timeline_start) {
    $("#milestoneTimelineNote").text(`Timeline limited to dates on or after '${USERDATA.config.force_timeline_start}'. Change this setting in General Configuration.`)  
  }
  else if (USERDATA.config.force_timeline_end) { 
    $("#milestoneTimelineNote").text(`Timeline limited to dates on or before '${USERDATA.config.force_timeline_end}'. Change this setting in General Configuration.`)  
  }

}

// ALLOCATIONS / RESOURCES SECTION -------------------------------

// this is a helper to add and remove dropzones for empty/non-empty task lists
function addRemoveDropzones(){
  $(".task-list").each(function(){
    $(this).find('.task-dropzone').remove();
    if (!$(this).children().length) {
      template = document.getElementById('template-task-dropzone');
      clone = template.content.cloneNode(true);
      $(clone).find('.task-dropzone').appendTo(this);
    }
  });
}
// this rendors the resource sections into the DOM
function renderResources(){

  let resourceArr = []
  $("#alloc-title .count").text(USERDATA.tasks.filter(t => !t.completed).filter(matchesActiveFilters).length);

  [...USERDATA.resources, {"name":"Unallocated","type":""}].forEach(resource => {

    if (resource.name == "Unallocated"){
      assignedTasks = USERDATA.tasks
      .filter(t => !t.completed)
      .filter(t => (t.assignedTo === null))
    }else{
      assignedTasks = USERDATA.tasks
      .filter(t => !t.completed)
      .filter(t => (t.assignedTo === resource.name))
    }

    assignedTasks = assignedTasks
      .filter(matchesActiveFilters)
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

    template = document.getElementById('template-resource');
    clone = template.content.cloneNode(true);
    let resourceDiv = $(clone).find('.resource');
    //resourceDiv.appendTo("#allocations-list");
    resourceDiv.attr({id: createHtmlIdFromString(resource.name)});
    resourceDiv.find(".about h2").text(resource.name)
    if (resource.name == "Unallocated"){resourceDiv.find(".about h2").addClass("italic");}

    resourceDiv.find(".about div small.type").text(resource.type);
    resourceDiv.find(".about .count").text(assignedTasks.length);
    resourceDiv.find(".task-list").attr("data-resource", resource.name);

    menuEntryLi = $(`<li><a href="#${createHtmlIdFromString(resource.name)}" aria-current="page"><span>${resource.name}</span></a></li>`).appendTo('#menu-allocations-list')
    if (resource.name == "Unallocated"){menuEntryLi.find("span").addClass("italic pe-1");} // pe-1 needed to render the top of the end d when italicised!

    activeAssignedTasks = assignedTasks
      .filter(t => (t.active));
    backlogAssignedTasks = assignedTasks
      .filter(t => (!t.active));


    if (resource.name == "Unallocated"){
      taskListDivBacklog = resourceDiv.find(".task-list.tasks-backlog");
      activeAssignedTasks.forEach(t => { createTaskElement(t).appendTo(taskListDivBacklog); })
      backlogAssignedTasks.forEach(t => { createTaskElement(t).appendTo(taskListDivBacklog);})
      resourceDiv.find(".task-list.tasks-active").css("display", "none");
      resourceDiv.find(".task.backlog-divider").css("display", "none");
    }else{
      taskListDivActive = resourceDiv.find(".task-list.tasks-active");
      taskListDivBacklog = resourceDiv.find(".task-list.tasks-backlog");
      activeAssignedTasks.forEach(t => { createTaskElement(t).appendTo(taskListDivActive); })
      backlogAssignedTasks.forEach(t => { createTaskElement(t).appendTo(taskListDivBacklog);})
    }

    // renderTasksTimeline(createHtmlIdFromString(resource.name), assignedTasks)
    resourceDiv.find("button.timeline").attr("data-resource-id", resource.name);
    resourceDiv.find("button.add-task").attr("data-resource-id", resource.name);

    resourceArr.push(resourceDiv);

  })

  $("section#allocations #allocations-list").append(resourceArr)
}

// COMPLETED TASKS SECTION -------------------------------

// this updates the count and if "showCompleted" is true, renders the completed task list
function renderCompletedTasks(){

  completedDiv = $("section#completed")

  completedTasks = USERDATA.tasks
    .filter(matchesActiveFilters)
    .filter(t => t.completed);

  completedDiv.find(".count").text(completedTasks.length);
  if (showCompleted) { 
      $('button.show-completed-tasks').text("Hide Completed Task List"); 
      $("#old-task-deletion-group").removeClass("hidden"); 
    } else { 
      $('button.show-completed-tasks').text("Show Completed Task List");
      $("#old-task-deletion-group").addClass("hidden");
    }
  completedTaskListDiv = completedDiv.find("#completed-task-list");
  completedTaskListDiv.html("");

  if (showCompleted) {
    completedTaskArr = []
    completedTasks.sort((a, b) => {
      let aCompleted = a.completed;
      let bCompleted = b.completed;
      if (aCompleted && bCompleted) {
        if (aCompleted !== bCompleted) {
          return aCompleted.localeCompare(bCompleted);
        }
      }
      return 0;
    }).forEach(t => { completedTaskArr.push(createTaskElement(t)) })
    completedTaskListDiv.append(completedTaskArr);
  }

}

// BUTTONS, DRAGGING -------------------------------

// called from the show timeline click event
function renderTasksTimeline(name) {

  host = $('#dialog-task-timeline .timeline-holder').get(0); // raw js dom element
  if (!host) return;

  if (name == "Unallocated"){
    taskData = structuredClone(USERDATA.tasks)
    .filter(t => !t.completed)
    .filter(t => (t.assignedTo === null))
  }else{
    taskData = structuredClone(USERDATA.tasks)
    .filter(t => !t.completed)
    .filter(t => (t.assignedTo === name))
  }
  taskData = taskData
    .filter(matchesActiveFilters)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

  taskData.forEach(task => {
    task.derivedDate = null;
    if (task.milestoneId) {
      const ms = milestoneFromId(task.milestoneId);
      if (ms) {
        if (ms.date != "") {
          task.derivedDate = ms.date;
        }
      }
    } else if (task.date) {
      task.derivedDate = task.date;
    }

    task.color = colorFromCategoryCode(task.category)
    //if (task.color) {task.color = task.color.color;}
  })

  // Only dated tasks make sense on a time scale
  const dated = taskData
    .filter(t => t && t.derivedDate != null )
    .sort((a, b) => new Date(a.derivedDate) - new Date(b.derivedDate));

  // If none, hide the timeline area
  if (dated.length === 0) {
    host.innerHTML = "";
    host.style.display = "none";
    return;
  }
  host.style.display = "";

  // Map your objects to what d3-milestones expects (timestamp + text)
  let data = dated.map(m => ({
    date: m.derivedDate,
    title: m.text,
    textStyle: m.color ? {
      "color": m.color
    } : undefined
  }));

  // --- Add a synthetic "Today" marker (red) ---
  const today = todayYMD();

  // Prevent duplicates if you already have a milestone dated today with the same label
  const hasToday = data.some(d => d.date === today && d.title === "Today");

  if (!hasToday) {
    data.push({
      date: today,
      title: "Today",
      textStyle: {"color": "red"}
    });
  }

  // keep timeline ordered
  data.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (USERDATA.config.force_timeline_start) {
    data = data.filter(m => m.date >= USERDATA.config.force_timeline_start);
    data.unshift({
      date: USERDATA.config.force_timeline_start,
      title: "Timeline Start",
      textStyle: { "opacity": "0.5" }
    })
  }
  if (USERDATA.config.force_timeline_end) {
    data = data.filter(m => m.date <= USERDATA.config.force_timeline_end);
    data.push({
      date: USERDATA.config.force_timeline_end,
      title: "Timeline End",
      textStyle: { "opacity": "0.5" }
    })
  }

  console.log(`TIMELINE: Rendering resource '${name}' timeline.`)
  renderTimeline(`#dialog-task-timeline .timeline-holder`, data, function () {
    $(".milestones-text-label").filter(function () {
      return $.trim($(this).text()) === "Today";
    }).parent().parent().parent().parent().addClass("milestone-vis-today");
  });
  if (USERDATA.config.force_timeline_start && USERDATA.config.force_timeline_end) { 
    $(".timeline-holderNote").text(`Timeline limited to dates on or after '${USERDATA.config.force_timeline_start}' and on or before '${USERDATA.config.force_timeline_end}'. Change this setting in General Configuration.`) 
  }
  else if (USERDATA.config.force_timeline_start) {
    $(".timeline-holderNote").text(`Timeline limited to dates on or after '${USERDATA.config.force_timeline_start}'. Change this setting in General Configuration.`)  
  }
  else if (USERDATA.config.force_timeline_end) { 
    $(".timeline-holderNote").text(`Timeline limited to dates on or before '${USERDATA.config.force_timeline_end}'. Change this setting in General Configuration.`)  
  }

}
// this sets up the draggable tasks, between resources and within an resource's task list
function enableDragging() {
  if (window.sortableInstances) window.sortableInstances.forEach(s => s.destroy());
  window.sortableInstances = [];
  $('.task-list').each(function(index, taskList) {
      const sAlloc = new Sortable(taskList, {
        group: { name: 'alloc' },
        animation: 150,
        direction: 'vertical',
        swapThreshold: 0.9,
        invertSwap: false,
        draggable: '.task',
        filter: '.task-dropzone',
        preventOnFilter: true,
        onEnd(evt) {

          const toList = $(evt.to);
          const fromList = $(evt.from);

          const toResource = toList.attr("data-resource");
          const fromResource = fromList.attr("data-resource");

          const taskId = Number(evt.item.dataset.itemid);
          const task = USERDATA.tasks.find(t => t.id === taskId);

          // update assignment (ignore divider)
          if (task && taskId !== -1) {
            if (toResource == "Unallocated") { task.assignedTo = null; } else {
              task.assignedTo = toResource;
            }

          }

          toastMessage = null;
          if (toResource == fromResource){
            // toastMessage = `<strong>${task.text}</strong> was re-prioritised.`; // comment out to disable
          } else if (taskId !== -1) {
            toastMessage = `<strong>${task.text}</strong> was re-allocated to <strong>${toResource}</strong>.`;
          }
          if (toastMessage) { showToast('success', 'Task Moved', toastMessage); }
          updateTaskPriorityFromPage();
          addRemoveDropzones();
          setChangesPresent(true);
        }
      });
      window.sortableInstances.push(sAlloc);
    });
}
// this function sets up the add task modal (prefills the allocation to where it was clicked from)
function setupAndShowAddTaskModal(name){
  if (name == "Unallocated") { $("#dialog-add-task-assigned").val('');  }
  else { $("#dialog-add-task-assigned").val(name); }
  $('#dialog-add-task').get(0).showModal();
}
// this creates a stored task when save button is pressed on the add task modal
function addMilestone() {

  m = {}
  m.id = generateUniqueMilestoneId();

  m.name = $("#dialog-add-milestone-name").val(); if (m.name == ""){ m.name = "UN-NAMED MILESTONE - GIVE ME A NAME!! 🤣"; } $("#dialog-add-milestone-name").val(""); // clear it for next time
  m.date = $("#dialog-add-milestone-date").val(); if (m.date == ""){ m.date = null; } $("#dialog-add-milestone-date").val("");
  m.tentative = $("#dialog-add-milestone-tentative").prop("checked"); $("#dialog-add-milestone-tentative").prop("checked", false);
  m.link = $("#dialog-add-milestone-other").val(); if (m.link == ""){ m.link = null; } $("#dialog-add-milestone-other").val("");

  USERDATA.milestones.push(m)
  showToast('success', 'Milestone Added', `<strong>${m.text}</strong> was created!`)
  updatePage();
}
// this shows the edit milestone modal
function setupAndShowEditMilestoneModal(id){
  m = milestoneMap[id];  
  $("#dialog-edit-milestone-name-disp").text(m.name);
  $('#dialog-edit-milestone-id').val(m.id);
  $('#dialog-edit-milestone-name').val(m.name);
  $('#dialog-edit-milestone-date').val(m.date || "");
  $('#dialog-edit-milestone-tentative').prop("checked", !!m.tentative);
  $('#dialog-edit-milestone-other').val(m.link || "");
  $('#dialog-edit-milestone').get(0).showModal();
}
// this updates the stored milestone when the dave button is pressed on the edit milestone modal
function saveEditedMilestone() {

  targetId = Number($("#dialog-edit-milestone-id").val()); $('#dialog-edit-milestone-id').val("");
  $("#dialog-edit-milestone-name-disp").text("");

  m = milestoneMap[targetId];

  m.name = $('#dialog-edit-milestone-name').val(); if (m.name == "") { m.name = "UN-NAMED MILESTONE - GIVE ME A NAME!! 🤣"; } $("#dialog-edit-milestone-name").val("");
  m.date = $('#dialog-edit-milestone-date').val(); if (m.date == ""){ m.date = null; } $('#dialog-edit-milestone-date').val("");
  m.tentative = $('#dialog-edit-milestone-tentative').prop("checked"); $('#dialog-edit-milestone-tentative').prop("checked", false);
  m.link = $("#dialog-edit-milestone-other").val(); if (m.link == ""){ m.link = null; } $("#dialog-edit-milestone-other").val("");

  showToast('success', 'Milestone Edited', `<strong>${m.name}</strong> was edited successfully.`)

  updatePage();

}
// this shows the milestone deletion alert dialog
function askMilestoneDeletion(id){
  m = milestoneMap[id];
  $("#alert-delete-milestone-name").text(m.name);
  $("#alert-delete-milestone button.confirm").attr("data-task-id", id);
  linkedTaskCount = USERDATA.tasks.filter(t => t.milestoneId == m.id).length;
  if (linkedTaskCount) {
    $("#alert-delete-milestone .linked .count").text(linkedTaskCount); $("#alert-delete-milestone .linked").removeClass("hidden");
  } else { $("#alert-delete-milestone .linked .count").text(linkedTaskCount); $("#alert-delete-milestone .linked").addClass("hidden"); }
  $("#alert-delete-milestone").get(0).showModal();
}
// this deletes a stored milestone when confirmed on the milestone deletion alert dialog - waterfalling dates to linked tasks first
function deleteMilestone(id){
  m = milestoneMap[id];
  USERDATA.tasks.filter(t => t.milestoneId == id).forEach(t => {
    t.date = m.date;
    t.milestoneId = null;
  })
  deletedTaskText = m.name;
  USERDATA.milestones = USERDATA.milestones.filter(t => id != t.id);
  showToast('success', 'Milestone Deleted', `<strong>${deletedTaskText}</strong> is now deleted.`);
  updatePage();
}
// this creates a stored task when save button is pressed on the add task modal
function addTask() {

  t = {}
  t.id = generateUniqueTaskId();

  t.text = $("#dialog-add-task-name").val(); if (t.text == ""){ t.text = "UN-NAMED TASK - GIVE ME A NAME!! 🤣"; } $("#dialog-add-task-name").val("");
  t.assignedTo = $("#dialog-add-task-assigned").val(); if (t.assignedTo == ""){ t.assignedTo = null; } $("#dialog-add-task-assigned").val("");
  newMilestone = Number($("#dialog-add-task-milestone").val()); $("#dialog-add-task-milestone").val("")
  newDate = $("#dialog-add-task-date").val(); $("#dialog-add-task-date").val("");

  if (newMilestone){
    t.milestoneId = newMilestone;
    t.date = null;
  } else if (newDate != "") {
    t.milestoneId = null;
    t.date = newDate;
  } else {
    t.milestoneId = null;
    t.date = null;
  }

  t.category = $("#dialog-add-task-category").val(); if (t.category == ""){ t.category = null; } $("#dialog-add-task-category").val("")
  t.completed = $("#dialog-add-task-completed").prop("checked"); if (t.completed){ t.completed = todayYMD(); } $("#dialog-add-task-completed").prop("checked", false)
  t.linkConf = $("#dialog-add-task-confluence").val(); if (t.linkConf == ""){ t.linkConf = null; } $("#dialog-add-task-confluence").val("");
  t.linkJira = $("#dialog-add-task-jira").val(); if (t.linkJira == ""){ t.linkJira = null; } $("#dialog-add-task-jira").val("");
  t.linkOther = $("#dialog-add-task-other").val(); if (t.linkOther == ""){ t.linkOther = null; } $("#dialog-add-task-other").val("");

  USERDATA.tasks.push(t)
  showToast('success', 'Task Added', `<strong>${t.text}</strong> was created!`)
  updatePage();
}
// this shows the edit task modal
function setupAndShowEditTaskModal(id){
  t = taskMap[id];
  $("#dialog-edit-task-name-disp").text(t.text);
  $('#dialog-edit-task-id').val(t.id);
  $('#dialog-edit-task-name').val(t.text);
  if (t.assignedTo == "Unallocated") { $('#dialog-edit-task-assigned').val(''); }
  else { $('#dialog-edit-task-assigned').val(t.assignedTo || ""); }
  $('#dialog-edit-task-milestone').val(t.milestoneId || "");
  $('#dialog-edit-task-date').val(t.date || "");
  $('#dialog-edit-task-category').val(t.category || "");
  $('#dialog-edit-task-completed').prop("checked", !!t.completed);
  $('#dialog-edit-task-confluence').val(t.linkConf || "");
  $('#dialog-edit-task-jira').val(t.linkJira || "");
  $('#dialog-edit-task-other').val(t.linkOther || "");
  $('#dialog-edit-task').get(0).showModal();
}
// this updates the stored task when the dave button is pressed on the edit task modal
function saveEditedTask() {

  targetId = Number($("#dialog-edit-task-id").val()); $("#dialog-edit-task-id").val("");
  $("#dialog-edit-task-name-disp").text("");

  t = taskMap[targetId];

  t.text = $("#dialog-edit-task-name").val(); if (t.text == "") { t.text = "UN-NAMED TASK - GIVE ME A NAME!! 🤣"; } $("#dialog-edit-task-name").val("");
  t.assignedTo = $("#dialog-edit-task-assigned").val(); if (t.assignedTo == ""){ t.assignedTo = null; } $("#dialog-edit-task-assigned").val("");
  newMilestone = Number($("#dialog-edit-task-milestone").val()); $("#dialog-edit-task-milestone").val("");
  newDate = $("#dialog-edit-task-date").val(); $("#dialog-edit-task-date").val("")

  if (newMilestone){
    t.milestoneId = newMilestone;
    t.date = null;
  } else if (newDate != "") {
    t.milestoneId = null;
    t.date = newDate;
  } else {
    t.milestoneId = null;
    t.date = null;
  }

  t.category = $("#dialog-edit-task-category").val(); if (t.category == ""){ t.category = null; } $("#dialog-edit-task-category").val("");
  inputCompleted = $("#dialog-edit-task-completed").prop("checked");
  console.log(t.text, t.completed, Boolean(inputCompleted), inputCompleted)
  if (t.completed != Boolean(inputCompleted)){    
    if (t.completed) { t.completed = false; } else if (t.completed == false) { t.completed = todayYMD(); }
  } $("#dialog-edit-task-completed").prop("checked", false);
  console.log(t.completed)

  t.linkConf = $("#dialog-edit-task-confluence").val(); if (t.linkConf == ""){ t.linkConf = null; } $("#dialog-edit-task-confluence").val("");
  t.linkJira = $("#dialog-edit-task-jira").val(); if (t.linkJira == ""){ t.linkJira = null; } $("#dialog-edit-task-jira").val("");
  t.linkOther = $("#dialog-edit-task-other").val(); if (t.linkOther == ""){ t.linkOther = null; } $("#dialog-edit-task-other").val("");

  showToast('success', 'Task Edited', `<strong>${t.text}</strong> was edited successfully.`)

  updatePage();

}
// this either shows the task complete alert dialog or uncompletes a stored task
function toggleMilestoneTentative(id){
  m = milestoneMap[id];
  m.tentative = !m.tentative;
  if (!m.tentative){
    showToast('success', 'Milestone Not-Tentative', `<strong>${m.name}</strong> is set to NOT tentative.`)
    updatePage();
  }else{    
    showToast('success', 'Milestone Tentative', `<strong>${m.name}</strong> is set to tentative.`)
    updatePage();
  }
}
// this either shows the task complete alert dialog or uncompletes a stored task
function toggleTaskCompletion(id){
  t = taskMap[id];
  if (!t.completed){
    $("#alert-complete-task-name").text(t.text);
    $("#alert-complete-task button.confirm").attr("data-task-id", id);
    $("#alert-complete-task").get(0).showModal();
  }else{
    t.completed = false;
    showToast('success', 'Task INcomplete', `<strong>${t.text}</strong> is set to NOT complete.`)
    updatePage();
  }
}
// this sets a stored task to complete when confirmed on the task complete alert dialog
function setTaskComplete(id){
  t = taskMap[id];
  t.completed = todayYMD();
  showToast('success', 'Task Completed', `<strong>${t.text}</strong> is set to complete.`);
  updatePage();
}
// this shows the task deletion alert dialog
function askTaskDeletion(id){
  t = taskMap[id];
  $("#alert-delete-task-name").text(t.text);
  $("#alert-delete-task button.confirm").attr("data-task-id", t.id);
  $("#alert-delete-task").get(0).showModal();
}
// this deletes a stored task when confirmed on the task deletion alert dialog
function deleteTask(id){
  deletedTaskText = USERDATA.tasks.filter(t => id == t.id)[0].text;
  USERDATA.tasks = USERDATA.tasks.filter(t => id != t.id);
  showToast('success', 'Task Deleted', `<strong>${deletedTaskText}</strong> is now deleted.`);
  updatePage();
}
// this shows the completed task deletion alert dialog (if there is a valid date chosen)
function askDeleteCompleteTasksBefore(){
  $("input#remove-complete-tasks-threshold-date").attr("aria-invalid", "false");
  dateStr = $("input#remove-complete-tasks-threshold-date").val();
  if (dateStr == "") { $("input#remove-complete-tasks-threshold-date").attr("aria-invalid", "true"); return false; }
  $("#alert-delete-completed-tasks-date").text(dateStr);  
  document.getElementById('alert-delete-completed-tasks').showModal();    
}
// this deletes completed tasks with a date before selected date. occurs on alert confirmation
function deleteCompleteTasksBefore(){
  ymd = $("input#remove-complete-tasks-threshold-date").val();
  USERDATA.tasks = USERDATA.tasks.filter(t => {    
    if (!t.completed) return true; // If no completed date → keep it    
    return t.completed.localeCompare(ymd) >= 0; // Keep only if completed >= provided date
  });
  $("input#remove-complete-tasks-threshold-date").val("");
  showToast('success', 'Tasks Deleted', `Completed tasks before <strong>${ymd}</strong> are now deleted.`);
  updatePage();
  
}
// this renders a resources' task timeline and shows in the task timeline modal - triggered by button press
function showResourceTimeline(name){
  $('#dialog-task-resource-name').text(name);
  $('#dialog-task-timeline .timeline-holder').html('');
  renderTasksTimeline(name);
  $('#dialog-task-timeline').get(0).showModal();
}
// clears all active filters
function clearTaskFilters() {
  activeFilters.categories.clear();
  activeFilters.milestones.clear();
  activeFilters.dateBefore = null;
  activeFilters.dateAfter = null;
  activeFilters.excludePerpetual = false;
  activeFilters.searchText = "";
  var currentUnsavedChanges = unsavedChanges;
  updatePage();
  setChangesPresent(currentUnsavedChanges);
}
// apply the filters from the modal inputs
function applyFilters(){

  $("#dialog-configure-task-filters *").removeAttr("aria-expanded"); // without this the multi-selects can get broken

  activeFilters.categories.clear();
  for (const item of $("#dialog-configure-task-filters .select-multiple-categories").get(0).value) {
    activeFilters.categories.add(item);
  }
  activeFilters.milestones.clear();
  for (const item of $("#dialog-configure-task-filters .select-multiple-milestones").get(0).value) {
    activeFilters.milestones.add(item);
  }
  activeFilters.searchText = $("#dialog-configure-task-filters #filters-string").val();  
  activeFilters.dateAfter = $("#dialog-configure-task-filters #filters-after-date-input").val();  
  if (activeFilters.dateAfter == "") activeFilters.dateAfter = null;
  activeFilters.dateBefore = $("#dialog-configure-task-filters #filters-before-date-input").val();  
  if (activeFilters.dateBefore == "") activeFilters.dateBefore = null;

  activeFilters.excludePerpetual = $("#dialog-configure-task-filters #filters-exclude-perpetual").prop("checked");

  var currentUnsavedChanges = unsavedChanges;
  updatePage();
  setChangesPresent(currentUnsavedChanges);
}
// this prefills the existing filters and shows the filters modal
function setupAndShowFiltersModal(){
  $("#dialog-configure-task-filters .select-multiple-categories").get(0).value = [...activeFilters.categories];
  $("#dialog-configure-task-filters .select-multiple-milestones").get(0).value = [...activeFilters.milestones];
  $("#dialog-configure-task-filters #filters-string").val(activeFilters.searchText);
  
  $("#dialog-configure-task-filters #filters-before-date-input").val(activeFilters.dateBefore);
  $("#dialog-configure-task-filters #filters-after-date-input").val(activeFilters.dateAfter);

  $("#dialog-configure-task-filters #filters-exclude-perpetual").prop("checked", activeFilters.excludePerpetual);
  $('#dialog-configure-task-filters').get(0).showModal();
}
// this sets up and shows the configure resources modal
function setupResourcesModal(){
  tmplt = $('#dialog-configure-resources .editable-resource-entry.hidden')
  $(tmplt).parent().find(".editable-resource-entry:not(.hidden)").remove();
  USERDATA.resources.forEach(r => {
    resDiv = tmplt.clone().removeClass("hidden")
    resDiv.attr("data-name", r.name)
    resDiv.find(".resource-name").val(r.name)
    resDiv.find(".resource-type").val(r.type)
    resDiv.appendTo($(tmplt).parent())
  })
  
  $('#dialog-configure-resources').get(0).showModal();
  
}
// this updates resources as needed from the resources modal apply event
function updateResourcesFromModal(){
  tmplt = $('#dialog-configure-resources .editable-resource-entry.hidden')
  holder = tmplt.parent();  
  holder.find(".editable-resource-entry:not(.hidden)").each(function(index, resEl) {
    if ($(resEl).attr("data-name")){ // if not a new one
      if ($(resEl).hasClass("opacity-25")){ // to be deleted      
        // reallocate the tasks to null
        USERDATA.tasks.filter(t => t.assignedTo == $(resEl).attr("data-name")).forEach(t => {t.assignedTo = null;});
        // remove the resource
        USERDATA.resources = USERDATA.resources.filter(r => r.name != $(resEl).attr("data-name")); 
        showToast('success', 'Resource Deleted', `<strong>${$(resEl).attr("data-name")}</strong> was deleted!`)
        // console.log($(resEl))
      } 
      else { // current resource to be edited
        res = resourceMap[$(resEl).attr("data-name").toLowerCase()] // resource to change name and type
        newName = $(resEl).find(".resource-name").val();     
        newType = $(resEl).find(".resource-type").val();   
        if (!(res.name == newName && res.type == newType)){
          res.name = newName
          if (res.name == "") { res.name = "UN-NAMED RESOURCE - GIVE ME A NAME!! 🤣"}
          res.type = newType        
          // change linked task reference to new name
          USERDATA.tasks.filter(t => t.assignedTo == $(resEl).attr("data-name")).forEach(t => {t.assignedTo = newName;});
          showToast('success', 'Resource Edited', `<strong>${$(resEl).attr("data-name")}</strong> was edited!`)
          // console.log($(resEl))
        }
      }
    }
    else if (!$(resEl).hasClass("opacity-25")){ // new resource (not deleted)
      r = {}
      r.name = $(resEl).find(".resource-name").val();  
      if (r.name == "") { r.name = "UN-NAMED RESOURCE - GIVE ME A NAME!! 🤣"}   
      r.type = $(resEl).find(".resource-type").val();   
      USERDATA.resources.push(r)
      showToast('success', 'Resource Created', `<strong>${r.name}</strong> was created!`)
      // console.log($(resEl))
    }    
  });  
  holder.find(".editable-resource-entry:not(.hidden)").remove();
  updatePage();
}
// this sets up and shows the configure categories modal
function setupCategoriesModal(){
  tmplt = $('#dialog-configure-categories .editable-category-entry.hidden')
  $(tmplt).parent().find(".editable-category-entry:not(.hidden)").remove();
  USERDATA.categories.forEach(c => {
    console.log(c)
    catDiv = tmplt.clone().removeClass("hidden")
    catDiv.attr("data-code", c.code)
    catDiv.find(".category-code").val(c.code)
    catDiv.find(".category-name").val(c.name)
    catDiv.find(".category-color").val(c.color).css("color", c.color);
    catDiv.appendTo($(tmplt).parent())
  })  
  $('#dialog-configure-categories').get(0).showModal();
  
}
// this updates resources as needed from the categories modal apply event
function updateCategoriesFromModal(){
  tmplt = $('#dialog-configure-categories .editable-category-entry.hidden')
  holder = tmplt.parent();  
  holder.find(".editable-category-entry:not(.hidden)").each(function(index, resEl) {
    if ($(resEl).attr("data-code")){ // if not a new one
      
      if ($(resEl).hasClass("opacity-25")){ // to be deleted      
        // reallocate the tasks to category=null
        USERDATA.tasks.filter(t => t.category == $(resEl).attr("data-code")).forEach(t => {t.category = null;});
        // remove the category
        USERDATA.categories = USERDATA.categories.filter(r => r.code != $(resEl).attr("data-code")); 
        showToast('success', 'Category Deleted', `<strong>${$(resEl).attr("data-code")}</strong> was deleted!`)
        // console.log($(resEl))
      } 
      else { // current category to be edited
        cat = categoryMap[$(resEl).attr("data-code").toLowerCase()] // category to change name and type
        newName = $(resEl).find(".category-name").val();     
        newCode = $(resEl).find(".category-code").val();   
        newColor = $(resEl).find(".category-color").val();   
        if (!(cat.name == newName && cat.color == newColor && cat.code == newCode)){
          cat.name = newName
          if (cat.name == "") { cat.name = "UN-NAMED CATEGORY - GIVE ME A NAME!! 🤣"}
          cat.code = newCode; 
          if (cat.code == "") { cat.code = "🤣"}
          cat.color = newColor;
          if (cat.color == "") { cat.color = "var(--foreground)"} // default
          // change linked task reference to new name
          USERDATA.tasks.filter(t => t.category == $(resEl).attr("data-code")).forEach(t => {t.category = newCode;});
          showToast('success', 'Category Edited', `<strong>${$(resEl).attr("data-name")}</strong> was edited!`)
          // console.log($(resEl))
        }
      }
    }
    else if (!$(resEl).hasClass("opacity-25")){ // new category (not deleted)
      newName = $(resEl).find(".category-name").val();     
      newCode = $(resEl).find(".category-code").val();   
      newColor = $(resEl).find(".category-color").val(); 
      cat = {}
      cat.name = newName
      if (cat.name == "") { cat.name = "UN-NAMED CATEGORY - GIVE ME A NAME!! 🤣"}
      cat.code = newCode; 
      if (cat.code == "") { cat.code = "🤣"}
      cat.color = newColor;
      if (cat.color == "") { cat.color = "var(--foreground)"} // default
      USERDATA.categories.push(cat)
      showToast('success', 'Category Created', `<strong>${cat.name}</strong> was created!`)
      console.log($(resEl))
    }    
  });  
  holder.find(".editable-category-entry:not(.hidden)").remove();
  updatePage();
}
// this sets up the project config and setting modal
function setupConfigModal(){
  $("#dialog-configure-general-project-title").val(USERDATA.config.title);
  $("#dialog-configure-general-project-logo").val(USERDATA.config.logo);
  $("#dialog-configure-general-project-color").val(USERDATA.config.primary_color);
  $("#dialog-configure-general-milestone-start-date").val(USERDATA.config.force_timeline_start || "");
  $("#dialog-configure-general-milestone-end-date").val(USERDATA.config.force_timeline_end || "");
  $("#dialog-configure-general-soon").val(USERDATA.config.soon_duration);
  $('#dialog-configure-general').get(0).showModal();  
}
// this updates the project and config options when saved
function saveConfigFromModal() {

  USERDATA.config.title = $("#dialog-configure-general-project-title").val(); 
  if (USERDATA.config.title == "") { USERDATA.config.title = "NO PROJECT NAME"; } $("#dialog-configure-general-project-title").val("");

  USERDATA.config.logo = $("#dialog-configure-general-project-logo").val(); 
  if (USERDATA.config.logo == "") { USERDATA.config.logo = "NO PROJECT LOGO"; } $("#dialog-configure-general-project-logo").val("");

  USERDATA.config.primary_color = $("#dialog-configure-general-project-color").val(); 
  if (USERDATA.config.primary_color == "") { USERDATA.config.primary_color = "#888888"; } $("#dialog-configure-general-project-color").val("");

  USERDATA.config.force_timeline_start = $("#dialog-configure-general-milestone-start-date").val(); 
  if (USERDATA.config.force_timeline_start == "") { USERDATA.config.force_timeline_start = null; } $("#dialog-configure-general-milestone-start-date").val("");

  USERDATA.config.force_timeline_end = $("#dialog-configure-general-milestone-end-date").val(); 
  if (USERDATA.config.force_timeline_end == "") { USERDATA.config.force_timeline_end = null; } $("#dialog-configure-general-milestone-end-date").val("");

  USERDATA.config.soon_duration = Number($("#dialog-configure-general-soon").val()); 
  if (USERDATA.config.soon_duration == "") { USERDATA.config.soon_duration = 7; } $("#dialog-configure-general-soon").val("");

  showToast('success', 'Updated Configuration', `Updated project general configuration successfully.`)

  updatePage();

}
// sorts out the dark/light theme, memory, button, default and stuff
function themeChanger(){
  try {
    const stored = localStorage.getItem('themeMode');
    if (stored ? stored === 'dark'
                : matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {}

  const apply = dark => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('themeMode', dark ? 'dark' : 'light'); } catch (_) {}
  };

  document.addEventListener('basecoat:theme', (event) => {
    const mode = event.detail?.mode;
    apply(mode === 'dark' ? true
          : mode === 'light' ? false
          : !document.documentElement.classList.contains('dark'));
  });
}
// sorts out the page scaling, memory, button, default and stuff
function scaleChanger() {
  const KEY = 'fontScalePct';
  const DEFAULT = 90;   // your baseline
  const STEP = 5;       // increments/decrements
  const MIN = 60;       // adjust as you like
  const MAX = 140;      // adjust as you like

  const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

  const readStored = () => {
    try {
      const raw = localStorage.getItem(KEY);
      const n = raw == null ? NaN : Number(raw);
      return Number.isFinite(n) ? clamp(n) : DEFAULT;
    } catch (_) {
      return DEFAULT;
    }
  };

  const apply = (pct) => {
    const value = clamp(Math.round(pct)); // keep it clean
    document.documentElement.style.fontSize = value + '%';
    try { localStorage.setItem(KEY, String(value)); } catch (_) {}
  };

  // restore on load
  apply(readStored());

  document.addEventListener('basecoat:scale', (event) => {
    const d = event.detail || {};

    // 1) Explicit value: { value: 95 }
    if (typeof d.value === 'number' && Number.isFinite(d.value)) {
      apply(d.value);
      return;
    }

    // 2) Step: { step: +5 } or { step: -5 }
    if (typeof d.step === 'number' && Number.isFinite(d.step)) {
      apply(readStored() + d.step);
      return;
    }

    // 3) Convenience: { action: 'increase' | 'decrease' }
    if (d.action === 'increase') apply(readStored() + STEP);
    else if (d.action === 'decrease') apply(readStored() - STEP);
  });
}
// Warn user before closing or navigate away (if unsaved changes exist)
window.addEventListener("beforeunload", (event) => {
  if (unsavedChanges){
    event.preventDefault();
    event.returnValue = "Are you sure? There may be unsaved changes on this page!"; // Chrome shows default prompt
  }
});
// this saves the HTML file
function quineSavePage(readonly=false) {
  
  // setting up the UI state
  clearTaskFilters();
  sanitizeDOM();
  $("details#allocations-menu").prop("open", true);
  $("details#configurations-menu").prop("open", false);
  $(".toast").remove();
  $("#milestones-tab-2").click(); // make sure the milestones timeline is shown when saving

  USERDATA.config.last_saved = nowString();

  // rebuild the html and replace the data with the in-memory version
  html = `<!DOCTYPE html>\n` + document.documentElement.outerHTML.replace(
    /(?<=[<]!-- data --[>])[\s\S]*(?=[<]!-- end data --[>])/,
    `\n<script>USERDATA = ${JSON.stringify(USERDATA, null, 2)}<\/script>\n`
  );

  // this will break this part of the script, however the readonly shouldn't use this function
  if (readonly){ html = html.replace( "const readOnlyMode=false;", "const readOnlyMode=true;" ) } 
  
  // this removes initializes atributes for: data-sidebar-initialized | data-tabs-initialized | data-select-initialized | data-toaster-initialized
  html = html.replace(/\sdata-[a-z0-9-]+-initialized="[^"]*"/gi, '');

  // make it downloadable
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  let rawFilename = window.location.href.split('/').pop();
  rawFilename = rawFilename.split('?')[0].split('#')[0];
  if (readonly){ rawFilename=rawFilename.replace(".html", "_ro.html") }
  a.download = rawFilename;
  
  //trigger the download
  a.click();
  URL.revokeObjectURL(a.href);
  
  console.log("Savefile created.")

  updatePage();
  setChangesPresent(false);

}
// this copys the data as html to the clipboard for emailing
function exportHTMLSummary() {
  
  div = $("<div>");


  div.append($("<h1>").text(USERDATA.config.title));

  div.append($("<h2>").text("Milestones"));
  msul = $("<ul>");
  USERDATA.milestones
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;      // undated milestones last
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    })
    .forEach(m => { 
      msul.append($("<li>").text(`${m.name} (${m.date || "Perpetual / No Date"})`))
    })  
  div.append(msul);
  div.append($("<br />"));


  [...USERDATA.resources, {"name":"Unallocated","type":""}].forEach(resource => {      
    if (resource.name == "Unallocated"){
      assignedTasks = USERDATA.tasks
      .filter(t => !t.completed)
      .filter(t => (t.assignedTo === null))
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
      div.append($("<h2>").html(`${resource.name}`));
      tkul = $("<ul>");
    }else{
      assignedTasks = USERDATA.tasks
      .filter(t => !t.completed)
      .filter(t => (t.assignedTo === resource.name))
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
      div.append($("<h2>").html(`${resource.name} <small>(${resource.type})</small>`));
      tkul = $("<ul>");
    }
    assignedTasks.sort((a, b) => b.active - a.active).forEach(t => { 
      tkli = $("<li>")
      if (!t.active) { tkli.append(`BACKLOG: `); }
      tkli.append(t.text);
      if (t.category) { tkli.append(` [${t.category}]`); }
      if (t.milestoneId) { 
        ms = milestoneMap[t.milestoneId]; 
        if (ms) { 
          if (ms.date) { tkli.append(` (Milestone: ${ms.name} - ${ms.date})`) }
          else { tkli.append(` (Milestone: ${ms.name} - Perpetual / No Date)`) } ; 
        } 
      }
      else if (t.date) { tkli.append(` (Key Date: ${t.date})`); }
      else { tkli.append(` (Perpetual / No Date) `); } 
      if (t.linkJira) tkli.append(` `).append($("<a>",{
        href: t.linkJira,
        text: 'JIRA',
        target: '_blank'
      }));
      if (t.linkConf) tkli.append(` `).append($("<a>",{
        href: t.linkConf,
        text: 'Confluence',
        target: '_blank'
      }));
      if (t.linkOther) tkli.append(` `).append($("<a>",{
        href: t.linkOther,
        text: 'Other',
        target: '_blank'
      }));    
      tkul.append(tkli)
    })
    div.append(tkul)     
  })


  // Copy HTML to clipboard
  const blob = new Blob([div[0].innerHTML], { type: "text/html" });
  const data = [new ClipboardItem({ "text/html": blob })];

  navigator.clipboard.write(data)
    .then(() => showAlertModal("HTML summary copied to clipboard.", "Export"))
    .catch(() => showAlertModal("Failed to copy to clipboard.", "Export"));
  
  showToast('success', 'Copy to Clipboard', "Copied data to clipboard for pasting - doesn't include completed tasks.");
}

