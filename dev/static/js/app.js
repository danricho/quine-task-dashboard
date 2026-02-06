/* APP.JS */
let milestoneMap = {};
let categoryMap = {};

function upgradeAllocationOptionsInPlace() {
  if (!Array.isArray(allocationOptions)) return;
  for (let i = 0; i < allocationOptions.length; i++) {
    if (typeof allocationOptions[i] === "string") {
      allocationOptions[i] = { name: allocationOptions[i], type: "" };
    }
  }
}

function getAllocationName(opt) {
  if (typeof opt === "string") return opt;
  return (opt && typeof opt.name === "string") ? opt.name : "";
}

function getAllocationType(opt) {
  if (opt && typeof opt === "object" && typeof opt.type === "string") return opt.type.trim();
  return "";
}

function hasAllocationName(name) {
  return allocationOptions.some(o => getAllocationName(o) === name);
}

function removeAllocationByName(name) {
  const idx = allocationOptions.findIndex(o => getAllocationName(o) === name);
  if (idx >= 0) allocationOptions.splice(idx, 1);
}

function allocationSlug(name) {
  return String(name)
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll(":", "");
}

function clearRenderedElements(){
  $("#milestoneList, #allocationOptionSections, #unallocated .task-list, #saveDate, #menuAllocationOptions, #logo, #byLine, #pageTitle").html("");
  $(".count").html("");
  $("#confirmModalTitle, #taskEditModal .itemName, #taskMilestone, #completedTasks .completed-list").html("");
  $(".tsk-milestone, #existingCategoriesList, #existingAllocationsList, #taskCategory, .tsk-category, #taskAssigned, .active-filter-summary").empty();
  
  document.title = "";
}

function render() {

  injectBacklogDivider();
  markUnsavedChanges();

  const $main = $('main');
  const scrollTop = $main.scrollTop(); // preserve

  milestoneMap = Object.fromEntries(milestones.map(m => [m.id, m]));
  categoryMap = Object.fromEntries((categories || []).map(c => [c.code, c]));

  clearRenderedElements();
  console.log("Re-Rendering.");

  $("#saveButton").prop("disabled", false);
  $("#saveDate").text(saveDate);
  $("#pageTitle").text(pageTitle);
  document.title = pageTitle;
  $("#logo").html(logo);
  $('#byLine').text(byLine);

  renderMilestones();
  renderMilestoneDropdowns();
  renderCategoryDropdowns(); 
  renderAllocationOptionSections();
  renderUnallocatedTasks();  
  updateTaskAllocationsTotalCount();
  if (!renderReadOnly){
    enableDragging();
    makeTaskTitlesAndDatesEditable();
  }
  renderCompletedTasks();
  updateCategoryList();
  updateAllocationList();
  updateFiltersButtonState();
  $('.active-filter-summary').text(getActiveFilterString());

  $main.scrollTop(scrollTop); // restore

  if (renderReadOnly){

    $("#saveButton").parent().hide();
    $("#manageAllocations, #manageCategories").hide();    
    $("#milestones div[role=group] input, #milestones div[role=group] button").prop('disabled', true);
    $(".delete-milestone").hide();
    $("#addMilestone, .addTask").parent().hide();    
    $("p.guidance").hide();
    $("span.delete").parent().hide();
    $("#read-only-banner").show();
    
  } else { // NOT NEEDED AS SAVE ISN'T HAPPENING IF IN READ ONLY... SAVED WILL ALWAYS BE EDITABLE...
  }


}

function renderMilestones() {
  const container = document.getElementById("milestoneList");
  container.innerHTML = ""; // Clear
  const frag = document.createDocumentFragment();

  milestones
    .slice()
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;      // undated milestones last
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    })
    .forEach(ms => {
      const group = document.createElement("div");
      group.setAttribute("role", "group");

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = ms.name;
      nameInput.className = "ms-name";
      nameInput.dataset.milestoneid = ms.id;
      group.appendChild(nameInput);

      // Compute linked usage and completion
      const linked = tasks.filter(t => t.milestoneId === ms.id);
      const used = linked.length > 0;
      const allComplete = used && linked.every(t => t.completed === true);

      // Show delete if:
      //  A) milestone is unused (as today), OR
      //  B) all linked tasks are completed (new behavior)
      if (!used || allComplete) {
        const btn = document.createElement("button");
        btn.textContent = "×";
        btn.className = "danger delete-milestone";
        btn.title = !used
          ? "Delete milestone"
          : "Delete milestone (all linked tasks are complete: set their due date to the milestone date, de-link, then delete)";
        btn.dataset.milestoneid = ms.id;
        btn.dataset.mode = (!used ? "unused" : "all-complete"); // we’ll branch on this later
        group.appendChild(btn);
      }

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = ms.date;
      dateInput.className = "ms-date";
      dateInput.dataset.milestoneid = ms.id;
      if (ms.date) {
        if (isPastDate(ms.date)) dateInput.classList.add("late");
        else if (isSoon(ms.date)) dateInput.classList.add("soon");
      }
      group.appendChild(dateInput);   
      
      const tentativeBtn = document.createElement("button");
      tentativeBtn.textContent = "Tentative";
      tentativeBtn.className = ms.tentative ? "tentative-btn active" : "tentative-btn";
      tentativeBtn.dataset.milestoneid = ms.id;
      tentativeBtn.type = "button";
      tentativeBtn.className = ms.tentative ? 'tentative-btn active' : 'tentative-btn';
      tentativeBtn.dataset.milestoneid = ms.id;

      group.appendChild(tentativeBtn);

      frag.appendChild(group);
    });

  $("#ms-count").html(`(${milestones.length})`)

  container.appendChild(frag);
}

function deleteMilestoneWhenAllComplete(msId) {
  const ms = getMilestoneById(msId);
  if (!ms) return;

  // For every task linked to this milestone, set a direct due date and unlink
  tasks
    .filter(t => t.milestoneId === msId)
    .forEach(t => {
      t.due = ms.date;     // preserve the milestone date on the task
      t.milestoneId = null;
    });

  // Now call your existing function to actually remove the milestone
  // (Assumes deleteMilestone(msId) removes from `milestones` and then re-renders/saves, as it does today)
  deleteMilestone(msId);

  // Optional: a friendlier toast if your deleteMilestone doesn’t already show one
  if (typeof showToast === 'function') {
    showToast("Milestone deleted and completed tasks relinked to its date.", "success");
  }
}

const BACKLOG_MARKER_ID = -1; // Reserved ID

function injectBacklogDivider() {
  if (!tasks.find(t => t.id === BACKLOG_MARKER_ID)) {
    tasks.push({
      id: BACKLOG_MARKER_ID,
      text: "-- Backlog Starts Here --",
      assignedTo: null,
      priority: tasks.length, // append to end
      isBacklogDivider: true
    });
  }
}

function renderMilestoneDropdowns() {
  const selects = document.querySelectorAll(".tsk-milestone");
  selects.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = `<option value="">-- Select milestone (optional) --</option>`;
    milestones
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(ms => {
        const opt = document.createElement("option");
        opt.value = ms.id;
        opt.textContent = ms.date
          ? `${ms.name} (${ms.date})`
          : `${ms.name} (no date)`;
        if (opt.value === currentValue) opt.selected = true;
        select.appendChild(opt);
      });
  });
}

function renderCategoryDropdowns() {
  // Add/Task rows
  document.querySelectorAll("select.tsk-category").forEach(select => {
    const current = select.value;
    select.innerHTML = `<option value="">Category (optional)</option>`;
    (categories || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.name} (${c.code})`;
      if (current && current === c.code) opt.selected = true;
      select.appendChild(opt);
    });
  });

  // Edit modal
  const modalSelect = document.getElementById("taskCategory");
  if (modalSelect) {
    const existing = modalSelect.value;
    modalSelect.innerHTML = `<option value=""></option>`;
    (categories || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.name} (${c.code})`;
      modalSelect.appendChild(opt);
    });
    if (existing) modalSelect.value = existing;
  }
}


function getMilestoneById(id) {
  return milestoneMap[id] || null;
}

// Helper: ensure dropzones exist on empty sides of the backlog divider
function ensureBacklogDropzones(containerEl) {
  // remove any old dropzones to avoid duplicates
  containerEl.querySelectorAll('.backlog-dropzone').forEach(el => el.remove());

  const dividerEl = containerEl.querySelector('.backlog-divider');
  if (!dividerEl) return;

  // count tasks above/below (exclude divider)
  const children = Array.from(containerEl.children);
  const dividerIdx = children.indexOf(dividerEl);

  const isTask = el => el.classList && el.classList.contains('task') && !el.classList.contains('backlog-divider');

  const aboveCount = children.slice(0, dividerIdx).filter(isTask).length;
  const belowCount = children.slice(dividerIdx + 1).filter(isTask).length;

  // If empty above, add a dropzone just above the divider
  if (aboveCount === 0) {
    const dzAbove = document.createElement('div');
    dzAbove.className = 'task backlog-dropzone backlog-dropzone--above';
    // Important: not a .task, so it won’t be draggable or counted as a task
    containerEl.insertBefore(dzAbove, dividerEl);
  }

  // If empty below, add a dropzone just below the divider
  if (belowCount === 0) {
    const dzBelow = document.createElement('div');
    dzBelow.className = 'task backlog-dropzone backlog-dropzone--below';
    containerEl.insertBefore(dzBelow, dividerEl.nextSibling);
  }
}

function updateTaskAllocationsTotalCount() {
  // total "not done" count for the whole Task Allocations section
  // - respects active filters
  // - excludes divider
  // - excludes completed
  const total = tasks
    .filter(matchesActiveFilters)
    .filter(t => t.id !== BACKLOG_MARKER_ID)
    .filter(t => !t.completed)
    .length;

  $("#tasks-count").html(`(${total})`);
}

function renderAllocationOptionSections() {
  const section = document.getElementById("allocationOptionSections");
  const menu = document.getElementById("menuAllocationOptions");
  section.innerHTML = "";
  menu.innerHTML = "";

  const frag = document.createDocumentFragment();
  const menuFrag = document.createDocumentFragment();

  allocationOptions.forEach(option => {
    const optionName = getAllocationName(option);
    const optionType = getAllocationType(option);

    const optiondiv = document.createElement("div");    
    //optiondiv.id = option.toLowerCase().replaceAll(" ","-").replaceAll("(","").replaceAll(")","").replaceAll(":","");
    optiondiv.id = allocationSlug(optionName);
    optiondiv.className = "option";
    // optiondiv.dataset.option = option;
    optiondiv.dataset.option = optionName;
    optiondiv.style = "margin-top: 1.5rem;"

    const h3 = document.createElement("h3");
    h3.style = "display: inline-block;";
    // h3.textContent = option;
    h3.textContent = optionName;
    optiondiv.appendChild(h3);

    if (optionType) {
      const typeSmall = document.createElement("small");
      typeSmall.style = "margin-left: .5rem; opacity: .7;";
      typeSmall.textContent = optionType;
      optiondiv.appendChild(typeSmall);
    }

    const small = document.createElement("small");
    small.style = "margin: 0 1rem;";
    // small.textContent = `(${tasks.filter(t => (t.assignedTo === option)).filter(matchesActiveFilters).filter(t => (t.id !== BACKLOG_MARKER_ID)).filter(t => !t.completed).length})`;
    small.textContent = `(${tasks.filter(t => (t.assignedTo === optionName)).filter(matchesActiveFilters).filter(t => (t.id !== BACKLOG_MARKER_ID)).filter(t => !t.completed).length})`;
    optiondiv.appendChild(small);

    const taskList = document.createElement("div");
    taskList.className = "task-list";

    const assignedTasks = tasks
      //.filter(t => (t.assignedTo === option || t.id === BACKLOG_MARKER_ID))
      .filter(t => (t.assignedTo === optionName || t.id === BACKLOG_MARKER_ID))
      .filter(matchesActiveFilters)
      .filter(t => !t.completed)
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

    for (const task of assignedTasks) {
      taskList.appendChild(createTaskElement(task)[0]); // jQuery → DOM
    }
    ensureBacklogDropzones(taskList);

    optiondiv.appendChild(taskList);

    const $group = $("#addTaskInputs").clone(true, true);
    $group.attr("id", ""); // avoid duplicate IDs
    // $group.find("button").addClass("addTask").attr("data-allocation", option);
    $group.find("button").addClass("addTask").attr("data-allocation", optionName);     
    $(optiondiv).append($group[0]);

    frag.appendChild(optiondiv);
    
    const li = document.createElement("li");
    const a = document.createElement("a");
    // a.href = `#${option.toLowerCase().replaceAll(" ","-").replaceAll("(","").replaceAll(")","").replaceAll(":","")}`;
    // a.textContent = option;
    a.href = `#${allocationSlug(optionName)}`;
    a.textContent = optionName;
    li.appendChild(a);
    menuFrag.appendChild(li);
  });

  const unallocatedLi = document.createElement("li");
  const a = document.createElement("a");
  a.href = "#unallocated";
  a.textContent = "Unallocated";
  unallocatedLi.appendChild(a);
  menuFrag.appendChild(unallocatedLi);

  section.appendChild(frag);
  menu.appendChild(menuFrag);
  
}

function renderUnallocatedTasks() {
  const container = document.querySelector("#unallocated .task-list");
  container.innerHTML = ""; // Clear previous content
  const frag = document.createDocumentFragment();

  tasks
    // .filter(t => (t.assignedTo === null || !allocationOptions.includes(t.assignedTo) || t.id === BACKLOG_MARKER_ID))
    .filter(t => (t.assignedTo === null || !hasAllocationName(t.assignedTo) || t.id === BACKLOG_MARKER_ID))
    .filter(matchesActiveFilters)
    .filter(t => !t.completed)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999))
    .forEach(task => {
      frag.appendChild(createTaskElement(task)[0]); // jQuery → native DOM node
    });

  container.appendChild(frag);
  ensureBacklogDropzones(container);

  //$("#tasks-allocations-unallocated-count").html(`(${tasks.filter(t => (!allocationOptions.includes(t.assignedTo) || t.assignedTo === null)).filter(matchesActiveFilters).filter(t => (t.id != BACKLOG_MARKER_ID)).filter(t => !t.completed).length})`)
  $("#tasks-allocations-unallocated-count").html(`(${tasks.filter(t => (!hasAllocationName(t.assignedTo) || t.assignedTo === null)).filter(matchesActiveFilters).filter(t => (t.id != BACKLOG_MARKER_ID)).filter(t => !t.completed).length})`)
  
}

function renderCompletedTasks() {
  const container = document.querySelector("#completedTasks .completed-list");
  container.innerHTML = "";
  const frag = document.createDocumentFragment();

  tasks
    .filter(t => t.completed)
    .filter(matchesActiveFilters)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999)) // sort if needed
    .forEach(task => {
      const $el = createTaskElement(task)[0];
      $el.classList.add("completed-task");
      frag.appendChild($el);
    });

  container.appendChild(frag);

  
  $("#tasks-complete-count").html(`(${tasks.filter(t => t.completed).filter(matchesActiveFilters).length})`)
}

function isValidDate(input) {
  // Check format using regex
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(input)) return false;

  // Parse the components
  const [year, month, day] = input.split('-').map(Number);

  // Check for valid date
  const date = new Date(input);
  return (
    date instanceof Date &&
    !isNaN(date) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function makeTaskTitlesAndDatesEditable() {
  $('.task .taskName').each(function () {
    const $el = $(this);
    if ($el.data('editable')) {
      $el.editable('destroy');
    }
    $el.editable({
      touch : true, lineBreaks : false, toggleFontSize : false,  closeOnEnter : true, emptyMessage : 'Task Name',
      callback : function( data ) {
        if( data.content ) {         
          id = parseInt(data.$el.parents('.task').attr("data-itemid"))
          const task = tasks.find(t => t.id === id);
          task.text = data.content;
        }            
        data.$el.removeAttr("data-edit-event");
        data.$el.removeAttr("style");
        console.log(`Task name edited to '${data.content}'.`);

        render();
      }
    });
  });

  $('.task .due.dateDriven').each(function () {
    const $el = $(this);
    if ($el.data('editable')) {
      $el.editable('destroy');
    }
    $el.editable({
      touch : true, lineBreaks : false, toggleFontSize : false, closeOnEnter : true,
      callback : function( data ) {
        const id = parseInt(data.$el.parents('.task').attr("data-itemid"));
        const task = tasks.find(t => t.id === id);        

        data.$el.removeAttr("data-edit-event");
        data.$el.removeAttr("style");    

        if (data.content === "") {
          task.due = null;
          console.log(`Task date cleared.`);
        } else if (isValidDate(data.content)) {
          task.due = data.content;
          console.log(`Task date edited to '${data.content}'.`);
        }    

        render();
      }
    });
  });
}

function rebalanceGroupPrioritiesForDomOrder(optionName, containerEl) {
  // --- Identify divider & split DOM into above/below arrays ---
  const dividerEl = containerEl.querySelector('.backlog-divider, [data-itemid="' + BACKLOG_MARKER_ID + '"]');
  const allTaskEls = Array.from(containerEl.querySelectorAll('.task'))
    .filter(el => !el.classList.contains('backlog-dropzone'));

  const idsAbove = [];
  const idsBelow = [];
  let seenDivider = false;

  for (const el of allTaskEls) {
    const id = Number(el.dataset.itemid);
    if (id === BACKLOG_MARKER_ID || el === dividerEl) {
      seenDivider = true;
      continue;
    }
    (seenDivider ? idsBelow : idsAbove).push(id);
  }

  // --- Resolve in-group tasks for this allocation option ---
  const inGroup = tasks
    .filter(t => !t.completed)
    // .filter(t => (optionName ? t.assignedTo === optionName : (t.assignedTo === null || !allocationOptions.includes(t.assignedTo))))
    .filter(t => (optionName ? t.assignedTo === optionName : (t.assignedTo === null || !hasAllocationName(t.assignedTo))))
    .filter(t => t.id !== BACKLOG_MARKER_ID);

  // Divider priority (fixed boundary)
  const dividerTask = tasks.find(t => t.id === BACKLOG_MARKER_ID);
  const dividerPriority = dividerTask ? dividerTask.priority : Number.MAX_SAFE_INTEGER;

  // Quick access
  const getTaskById = (id) => tasks.find(t => t.id === id);
  const getPriority = (id) => (getTaskById(id)?.priority);

  // Helper to decide if an id "belongs" to this segment by current priority
  const belongsAbove = (p) => p < dividerPriority;
  const belongsBelow = (p) => p > dividerPriority;

  // --- Core: assign priorities within a segment without renumbering others ---
  function assignSegment(ids, isAbove) {
    // Side test
    const keepSide = isAbove
      ? (p) => p < dividerPriority
      : (p) => p > dividerPriority;

    const getTaskById = (id) => tasks.find(t => t.id === id);
    const getPriority = (id) => {
      const t = getTaskById(id);
      return t ? Number(t.priority) : undefined;
    };

    const incumbents = ids.filter(id => {
      const p = getPriority(id);
      return p != null && keepSide(p);
    });
    const crossers = ids.filter(id => !incumbents.includes(id));

    // --- Case 1: pure in-segment reorder (no crossers)
    if (crossers.length === 0) {
      // Use the same set of priorities this segment already had,
      // but assign them in the new DOM order.
      const priorities = incumbents
        .map(id => getPriority(id))
        .sort((a, b) => a - b);

      ids.forEach((id, i) => {
        const t = getTaskById(id);
        if (t) t.priority = priorities[i];
      });
      return;
    }

    // --- Case 2: some items crossed the divider: mint only for crossers, keep incumbents
    const newP = new Map(); // id -> priority (kept or minted)

    // Seed incumbents with their current priorities (minimal change)
    for (const id of incumbents) newP.set(id, getPriority(id));

    // Helper to fetch a priority for neighbor if known/valid-for-side
    const neighborPriority = (id) => {
      if (id == null) return undefined;
      if (newP.has(id)) return newP.get(id);
      const p = getPriority(id);
      return (p != null && keepSide(p)) ? p : undefined;
    };

    // Walk left-to-right assigning priorities to crossers so they land correctly
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (newP.has(id)) continue; // incumbent, already seeded

      // Find nearest DOM neighbors that already have side-appropriate priorities
      const prevId = [...ids.slice(0, i)].reverse().find(j => newP.has(j) || keepSide(getPriority(j) ?? NaN));
      const nextId = ids.slice(i + 1).find(j => newP.has(j) || keepSide(getPriority(j) ?? NaN));

      // Numeric bounds
      let lower = (isAbove ? -Infinity : dividerPriority);
      let upper = (isAbove ? dividerPriority : +Infinity);

      const pPrev = neighborPriority(prevId);
      const pNext = neighborPriority(nextId);
      if (pPrev != null) lower = pPrev;
      if (pNext != null) upper = pNext;

      // Choose a number strictly between lower and upper; fall back near divider
      let minted;
      if (Number.isFinite(lower) && Number.isFinite(upper)) {
        minted = (lower + upper) / 2;
        if (minted <= lower || minted >= upper) minted = lower + (upper - lower) / 2;
      } else if (!Number.isFinite(lower) && Number.isFinite(upper)) {
        minted = upper - 1;
      } else if (Number.isFinite(lower) && !Number.isFinite(upper)) {
        minted = lower + 1;
      } else {
        // whole segment was empty before; anchor to divider
        minted = isAbove ? (dividerPriority - 1) : (dividerPriority + 1);
      }

      newP.set(id, minted);
    }

    // Apply
    newP.forEach((p, id) => {
      const t = getTaskById(id);
      if (t) t.priority = p;
    });
  }

  // Assign above and below independently
  assignSegment(idsAbove, true);
  assignSegment(idsBelow, false);
}

function enableDragging() {
  // Tear down old instances if any
  if (window.sortableInstances) window.sortableInstances.forEach(s => s.destroy());
  window.sortableInstances = [];

  // ALLOCATION LISTS (team buckets + Unallocated): divider is NOT draggable
  document.querySelectorAll('#allocationOptionSections .task-list, #unallocated .task-list')
    .forEach(taskList => {
      const sAlloc = new Sortable(taskList, {
        group: {
          name: 'alloc',
          // forbid dragging the divider out of / into allocation lists
          pull: (to, from, dragEl) => !dragEl.classList.contains('backlog-divider'),
          put:  (to, from, dragEl) => !dragEl.classList.contains('backlog-divider'),
        },
        animation: 150,
        direction: 'vertical',
        swapThreshold: 0.1,
        invertSwap: true,

        // Divider cannot be picked up in these lists
        draggable: '.task',
        filter: '.backlog-divider, .backlog-dropzone',
        preventOnFilter: false,

        // IMPORTANT: allow dropping NEXT TO the divider, even if one side is empty
        onMove(evt) {
          // Block only if the DRAGGED element is the divider (defensive)
          if (evt.dragged && evt.dragged.classList.contains('backlog-divider')) return false;
          // Allow when related is the divider OR the dropzone
          return true;
        },

        onEnd(evt) {
          const toList = evt.to;
          const fromList = evt.from;

          const toDivOption = toList.closest('div.option');
          const fromDivOption = fromList.closest('div.option');

          const newAssignedTo = toDivOption?.dataset.option || null;
          const oldAssignedTo = fromDivOption?.dataset.option || null;

          const taskId = Number(evt.item.dataset.itemid);
          const task = tasks.find(t => t.id === taskId);

          // update assignment (ignore divider)
          if (task && task.id !== BACKLOG_MARKER_ID) {
            task.assignedTo = newAssignedTo;
          }

          // Rebalance per segment so items stick where dropped
          if (newAssignedTo === oldAssignedTo) {
            rebalanceGroupPrioritiesForDomOrder(newAssignedTo, toList);
          } else {
            rebalanceGroupPrioritiesForDomOrder(newAssignedTo, toList);
            rebalanceGroupPrioritiesForDomOrder(oldAssignedTo, fromList);
          }

          render();
        }
      });
      window.sortableInstances.push(sAlloc);
    });
}

function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = message;

  container.appendChild(toast);

  // Force reflow to enable animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
// showToast("Something went wrong.", "error");
// showToast("You’re in offline mode.", "warning");
// showToast("Milestone updated and tasks adjusted.", "success");


function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to midnight
  const due = new Date(dateStr);
  return due < today;
}

function isSoon(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to midnight
  const due = new Date(dateStr);
  return (due - today)/1000 < (7 * 24 * 60 * 60);
}

function createTaskElement(task) {

  if (task.isBacklogDivider) {
    
    const $task = $("<div>").addClass("task backlog-divider").attr("data-itemid", task.id).attr("draggable", "false");
    const $content = $("<div class='backlog_divider'>Backlog Divider</div>");
    $task.append($content);
    // const $content = $("<div>").addClass("flex justify-center align-center").css({ fontStyle: "italic", opacity: 0.8 });
    // $content.text(task.text);
    // $task.append($content);
    return $task;
  }

  const $task = $("<div>").addClass("task").attr("data-itemid", task.id);
  const $grid = $("<div>").addClass("flex gap-3 items-baseline").appendTo($task);
  const $catDiv = $("<div>").addClass("flex-shrink").appendTo($grid);
  const $task_title = $("<div>").addClass("taskName").text(task.text).appendTo($grid);
  $("<small>").addClass("assignee").text(` (${task.assignedTo||"Unallocated"})`).appendTo($grid);

  const $rightOuter = $("<div>").addClass("flex-grow").appendTo($grid);
  const $right = $("<div>").addClass("flex gap-3 justify-end").appendTo($rightOuter);
  
  const $due = $("<div>").addClass("due").css({"display": "inline-block"}).appendTo($right);
  const $links = $("<div>").css({"display": "inline-block"}).appendTo($right);
  const $functions = $("<div>").addClass("no-print").css({"display": "inline-block"}).appendTo($right);
  let dueDate = null;
  let dueText = '';
  if (!task.due && task.milestoneId) {
    const ms = getMilestoneById(task.milestoneId);
    if (ms) {
      dueDate = ms.date;
      dueText = `<small class="${ms.tentative ? 'tentative' : ''}">${ms.name}</small> ${ms.date}`;
    }
    $due.addClass("milestoneDriven")
  } else if (task.due) {
    dueDate = task.due;
    dueText = `${task.due}`;
    if (task.milestoneId) {
      const ms = getMilestoneById(task.milestoneId);
      if (ms) dueText = `${ms.name} | ` + dueText ;
    }
    $due.addClass("dateDriven")
  }
  else {
      dueText = (`<small style="color: var(--pico-muted-color);" class="perpetual"><em>N/A</em></small>`);
  }
  $due.html(`${dueText}`);

  if (!task.completed){
    if (dueDate && isPastDate(dueDate)) { $task.addClass("late"); } 
    else if (dueDate && isSoon(dueDate)){ $task.addClass("soon"); }
  }
  
  if (task.category) {
    const cat = categoryMap[task.category] || { color: "inherit", name: task.category, code: task.category };
    $("<span>")
      .addClass("category")
      .attr("title", cat.name || task.category)
      .css("color", cat.color || "inherit")
      .text(cat.code || task.category)
      .appendTo($catDiv);
  }

  let svgConf = $(`<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 50 50"><path d="M 36.988281 2.9902344 C 36.519863 3.0093652 36.069688 3.2528906 35.804688 3.6816406 C 35.800688 3.6886406 35.795016 3.6941719 35.791016 3.7011719 C 35.411016 4.3361719 34.921672 5.1619219 34.388672 6.0449219 C 30.470672 13.059922 26.844437 11.486422 20.023438 8.2324219 L 10.609375 4.1308594 C 9.881375 3.7848594 9.0091094 4.0933125 8.6621094 4.8203125 C 8.6541094 4.8343125 8.6485781 4.846375 8.6425781 4.859375 L 4.1210938 14.705078 C 3.8020938 15.435078 4.1275625 16.285188 4.8515625 16.617188 C 6.8375625 17.551188 10.789703 19.411953 14.345703 21.126953 C 27.142703 27.335953 38.016938 26.934063 46.335938 13.414062 C 46.810938 12.641063 47.343875 11.742344 47.796875 11.027344 C 48.201875 10.343344 47.985594 9.4609687 47.308594 9.0429688 L 37.814453 3.2050781 C 37.557203 3.0464531 37.269332 2.9787559 36.988281 2.9902344 z M 21.050781 25.003906 C 14.442609 25.143818 8.6034688 28.546719 3.6640625 36.574219 C 3.1890625 37.347219 2.656125 38.245938 2.203125 38.960938 C 1.798125 39.644937 2.0144063 40.527312 2.6914062 40.945312 L 12.185547 46.783203 C 12.871547 47.206203 13.771312 46.994594 14.195312 46.308594 C 14.199312 46.301594 14.204984 46.294109 14.208984 46.287109 C 14.588984 45.652109 15.078328 44.828312 15.611328 43.945312 C 19.529328 36.930312 23.155563 38.501859 29.976562 41.755859 L 39.390625 45.859375 C 40.118625 46.205375 40.990891 45.896922 41.337891 45.169922 L 41.355469 45.130859 L 45.876953 35.285156 C 46.195953 34.555156 45.870484 33.705047 45.146484 33.373047 C 43.160484 32.439047 39.208344 30.578281 35.652344 28.863281 C 30.454375 26.340062 25.572162 24.908177 21.050781 25.003906 z"></path></svg>`)
  if (!(task['link-conf'] == undefined || task['link-conf'] == "")){ 
    link = $("<a>").attr("href", task['link-conf']).attr("target", "_blank").attr("title", "Confluence").appendTo($links);
    svgConf.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "cursor": "pointer"}).appendTo(link);
  }
  else { svgConf.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "opacity": "0.2"}).appendTo($links); }
  
  let svgJira = $(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.53,2a4.37,4.37,0,0,0,4.35,4.35h1.78v1.7A4.35,4.35,0,0,0,22,12.4V2.84A.85.85,0,0,0,21.16,2H11.53M6.77,6.8a4.36,4.36,0,0,0,4.34,4.34h1.8v1.72a4.36,4.36,0,0,0,4.34,4.34V7.63a.84.84,0,0,0-.83-.83H6.77M2,11.6a4.34,4.34,0,0,0,4.35,4.34H8.13v1.72A4.36,4.36,0,0,0,12.47,22V12.43a.85.85,0,0,0-.84-.84H2Z"/></svg>`)
  if (!(task['link-jira'] == undefined || task['link-jira'] == "")){ 
    link = $("<a>").attr("href", task['link-jira']).attr("target", "_blank").attr("title", "Jira").appendTo($links);
    svgJira.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "cursor": "pointer"}).appendTo(link);
  }
  else { svgJira.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "opacity": "0.2"}).appendTo($links); }

  let svgOther = $(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" version="1.1">
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g>
    <rect id="Rectangle" fill-rule="nonzero" x="0" y="0" width="24" height="24"></rect>
    <path d="M14,16 L17,16 C19.2091,16 21,14.2091 21,12 L21,12 C21,9.79086 19.2091,8 17,8 L14,8" id="Path" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    <path d="M10,16 L7,16 C4.79086,16 3,14.2091 3,12 L3,12 C3,9.79086 4.79086,8 7,8 L10,8" id="Path" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    <line x1="7.5" y1="12" x2="16.5" y2="12" id="Path" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </g></g>
</svg>`);
  if (!(task['link-other'] == undefined || task['link-other'] == "")) {
    let link = $("<a>").attr("href", task['link-other']).attr("target", "_blank").attr("title", "Other Link").appendTo($links);
    svgOther.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "cursor": "pointer"}).appendTo(link);
  } else {
    svgOther.css({'height': "1em", "color": "var(--pico-primary)", 'margin': "0 0.25rem", "opacity": "0.2"}).appendTo($links);
  }

  let svgEdit = $(`<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 30 30"><path d="M 22.828125 3 C 22.316375 3 21.804562 3.1954375 21.414062 3.5859375 L 19 6 L 24 11 L 26.414062 8.5859375 C 27.195062 7.8049375 27.195062 6.5388125 26.414062 5.7578125 L 24.242188 3.5859375 C 23.851688 3.1954375 23.339875 3 22.828125 3 z M 17 8 L 5.2597656 19.740234 C 5.2597656 19.740234 6.1775313 19.658 6.5195312 20 C 6.8615312 20.342 6.58 22.58 7 23 C 7.42 23.42 9.6438906 23.124359 9.9628906 23.443359 C 10.281891 23.762359 10.259766 24.740234 10.259766 24.740234 L 22 13 L 17 8 z M 4 23 L 3.0566406 25.671875 A 1 1 0 0 0 3 26 A 1 1 0 0 0 4 27 A 1 1 0 0 0 4.328125 26.943359 A 1 1 0 0 0 4.3378906 26.939453 L 4.3632812 26.931641 A 1 1 0 0 0 4.3691406 26.927734 L 7 26 L 5.5 24.5 L 4 23 z"></path></svg>  `)
  svgEdit.css({'height': "1em", "color": "var(--pico-secondary)", 'margin': "0 0.25rem", "cursor": "pointer"}).addClass('open-task-edit-modal').appendTo($functions);
  
  if (!task.isBacklogDivider) {
    const svgComplete = $(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path stroke="currentColor" d="M20.3 5.7c.4.4.4 1 0 1.4L10 17.4 4.7 12.1a1 1 0 1 1 1.4-1.4L10 14.6l9.3-9.3c.4-.4 1-.4 1.4 0z"/></svg>`);
    svgComplete
      .css({ height: "1em", margin: "0 0.25rem" })
      .addClass("complete")
      .data("taskid", task.id)
      .appendTo($functions);
  }

  // Add delete button
  $("<span>").text("×").addClass("delete").attr("title", "Delete task").appendTo($functions);

  return $task;
}

function generateUniqueMilestoneId() {
  return milestones.length > 0
    ? Math.max(...milestones.map(m => m.id)) + 1
    : 1;
}

function generateUniqueTaskId() {
  return tasks.length > 0
    ? Math.max(...tasks.map(t => t.id)) + 1
    : 1;
}

function normalizeAndGetNextPriority() {
  // Filter out tasks with undefined/null priorities
  const validTasks = tasks.filter(t => typeof t.priority === 'number');

  // Sort by current priority
  validTasks.sort((a, b) => a.priority - b.priority);

  // Reassign priorities to remove gaps
  validTasks.forEach((task, index) => {
    task.priority = index;
  });

  // Return the next available priority (which is now tasks.length)
  return validTasks.length;
}

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

let confirmCallback = null;
function showConfirmModal(message, onConfirm, contextLabel = null) {
  $('#confirmModalText').text(message);
  $('#confirmModalTitle').text(contextLabel ? `Confirm for ${contextLabel}` : 'Confirm Action');
  confirmCallback = onConfirm;
  $('#confirmModal')[0].showModal();
}

function showAlertModal(message, contextLabel = null) {
  $('#alertModalText').text(message);
  $('#alertModalTitle').text(contextLabel ? `Notice for ${contextLabel}` : 'Alert');
  $('#alertModal')[0].showModal();
}

function deleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    showConfirmModal("Are you sure you want to delete this task?", function () {
      tasks.splice(tasks.indexOf(task), 1);
      console.log(`Task '${task.text}' deleted.`)
      render();
      $('#confirmModal')[0].close();
    }, `Task '${task.text}'`);
  }
}

function deleteMilestone(milestoneId) {
  const milestone = milestones.find(m => m.id === milestoneId);
  const inUse = tasks.some(t => t.milestoneId === milestoneId);
  if (!milestone) return;

  if (inUse) {
    showAlertModal("Cannot delete milestone: It is assigned to one or more tasks.", `Milestone '${milestone.name}'`);
  } else {
    showConfirmModal("Are you sure you want to delete this milestone?", function () {
      milestones.splice(milestones.indexOf(milestone), 1);      
      console.log(`Milestone '${milestone.name}' deleted.`)
      render();
    }, `Milestone '${milestone.name}'`);
  }
}

function benchmarkRender(label, renderFn, iterations = 10) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`📊 Benchmark: ${label}`);
  console.log(`  Runs: ${iterations}`);
  console.log(`  Avg: ${avg.toFixed(2)} ms`);
  console.log(`  Min: ${min.toFixed(2)} ms`);
  console.log(`  Max: ${max.toFixed(2)} ms`);
}

function el(tag, text, ...children) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  children.forEach(c => { if (c) e.appendChild(c); });
  return e;
}

function formatTaskHTML(task) {

  const li = document.createElement("li");
  let text = "";
  
  if (task.category) text += `${task.category} | `;
  text += `${task.text} | `;
  
  if (task.due) text += `Due: ${task.due} | `;
  else if (task.milestoneId) {
    const ms = milestoneMap[task.milestoneId];
    if (ms)  text += `Milestone: ${ms.name} (${ms.date}) | `;
  }
  else {
    text += `No due date | `;
  }

  const links = [];
  if (task["link-jira"]) links.push(linkTag(task["link-jira"], "JIRA"));
  if (task["link-conf"]) links.push(linkTag(task["link-conf"], "Confluence"));
  if (task["link-other"]) links.push(linkTag(task["link-other"], "Other"));

  
  li.textContent = text;
  if (links.length > 0) {
    links.forEach(link => {
      li.appendChild(document.createTextNode(" "));
      li.appendChild(link);
    });
  }

  return li;
}

function linkTag(url, label) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = `[${label}]`;
  return a;
}

function exportHTMLSummary() {
  const div = document.createElement("div");

  // Page title
  div.appendChild(el("h1", pageTitle));
  div.appendChild(el("br"));

  // Milestones
  div.appendChild(el("h2", "Milestones"));
  div.appendChild(el("ul", null,
    ...milestones
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(m => el("li", `${m.name} (${m.date})`))
  ));

  div.appendChild(el("br"));

  // Task Priorities
  div.appendChild(el("h2", "Task Priority Order"));

  const sorted = tasks
    .filter(t => !t.completed)
    .filter(matchesActiveFilters)
    .slice()
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
  const dividerIndex = sorted.findIndex(t => t.isBacklogDivider);

  div.appendChild(el("p", "Active"));
  div.appendChild(el("ul", null, ...sorted.slice(0, dividerIndex).map(formatTaskHTML)));

  div.appendChild(el("p", "Backlog"));
  div.appendChild(el("ul", null, ...sorted.slice(dividerIndex + 1).map(formatTaskHTML)));
  
  div.appendChild(el("br"));

  // Allocations
  div.appendChild(el("h2", "Allocations"));
  allocationOptions.forEach(option => {
    const optionName = getAllocationName(option);
    const assigned = tasks
      // .filter(t => t.assignedTo === option && !t.completed)
      .filter(t => t.assignedTo === optionName && !t.completed)
      .filter(matchesActiveFilters)
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

    const active = assigned.filter(t => t.priority < sorted[dividerIndex]?.priority);
    const backlog = assigned.filter(t => t.priority > sorted[dividerIndex]?.priority);

    // div.appendChild(el("h3", option));
    div.appendChild(el("h3", optionName));

    if (active.length === 0 && backlog.length === 0) {
      div.appendChild(el("p", "(No tasks)"));
    } else {
      if (active.length > 0) {
        div.appendChild(el("p", "Active"));
        div.appendChild(el("ul", null, ...active.map(formatTaskHTML)));
      }
      if (backlog.length > 0) {
        div.appendChild(el("p", "Backlog"));
        div.appendChild(el("ul", null, ...backlog.map(formatTaskHTML)));
      }
    }
  });

  // Unallocated
  div.appendChild(el("h3", "Unallocated"));
  const unallocated = tasks
    .filter(t => t.assignedTo === null && !t.completed)
    .filter(matchesActiveFilters)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

  if (unallocated.length === 0) {
    div.appendChild(el("p", "(No tasks)"));
  } else {
    const active = unallocated.filter(t => t.priority < sorted[dividerIndex]?.priority);
    const backlog = unallocated.filter(t => t.priority > sorted[dividerIndex]?.priority);

    if (active.length > 0) {
      div.appendChild(el("p", "Active"));
      div.appendChild(el("ul", null, ...active.map(formatTaskHTML)));
    }

    if (backlog.length > 0) {
      div.appendChild(el("p", "Backlog"));
      div.appendChild(el("ul", null, ...backlog.map(formatTaskHTML)));
    }
  }

  div.appendChild(el("br"));
  // Completed
  div.appendChild(el("h2", "Completed Tasks"));
  const completed = tasks
    .filter(t => t.completed)
    .filter(matchesActiveFilters)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
  if (completed.length === 0) {
    div.appendChild(el("p", "(None)"));
  } else {
    div.appendChild(el("ul", null, ...completed.map(formatTaskHTML)));
  }

  // Copy HTML to clipboard
  const blob = new Blob([div.innerHTML], { type: "text/html" });
  const data = [new ClipboardItem({ "text/html": blob })];

  navigator.clipboard.write(data)
    .then(() => showAlertModal("HTML summary copied to clipboard.", "Export"))
    .catch(() => showAlertModal("Failed to copy to clipboard.", "Export"));
}

function updateAllocationList() {
  
  const $list = $('#existingAllocationsList');
  $list.empty();

  upgradeAllocationOptionsInPlace();

  allocationOptions.forEach(opt => {
    const name = getAllocationName(opt);
    const type = getAllocationType(opt);
    const inUse = tasks.some(t => t.assignedTo === name);

    const $li = $('<li>').css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr auto auto',
      gap: '.5rem',
      alignItems: 'center',
      padding: '.25rem 0'
    });

    const $name = $('<input type="text">')
      .addClass('alloc-edit-name')
      .val(name);

    const $type = $('<input type="text">')
      .addClass('alloc-edit-type')
      .attr('placeholder', 'Type (optional)')
      .val(type);

    const $save = $('<button type="button">')
      .addClass('small save-allocation')
      .text('Save')
      .attr('data-old', name);

    $li.append($name, $type, $save);

    if (!inUse) {
      const $del = $('<button type="button">')
        .addClass('small danger del-allocation')
        .css({ width: '3rem' })
        .text('×')
        .attr('title', 'Remove allocation')
        .attr('data-option', name);
      $li.append($del);
    } else {
      $li.append($('<small>').css({ opacity: 0.7 }).text('in use'));
    }

    $list.append($li);
  });

}

function updateCategoryList() {
  const $list = $('#existingCategoriesList');
  $list.empty();

  (categories || []).forEach(cat => {
    const inUse = tasks.some(t => t.category === cat.code);
    const $li = $('<li>').addClass("flex justify-evenly content-center");

    const $code = $('<strong>').text(cat.code).css({ marginRight: '.5rem' });
    const $name = $('<span>')
      .text(cat.name)
      .css({ outline: 'none' });

    // const $color = $('<input type="color">').val(cat.color).css({ "margin": '0 .5rem', "display": "inline-block", "width": "100px" });
    const colorSelect = document.createElement('select');
    // copy options from the HTML template
    colorSelect.innerHTML = document.getElementById('colorOptionsTemplate').innerHTML;
    $(colorSelect).css({ "width": "250px" })
    // set current value
    colorSelect.value = cat.color || "";
    colorSelect.addEventListener('change', () => {
      cat.color = colorSelect.value;
      render();
    });

    $li.css({"color": cat.color})
    $li.append($code, $name, colorSelect);

    if (!inUse) {
      const $del = $('<button>')
        .text('×')
        .css({ display: 'inline-block', width: '3rem', marginLeft: '1rem' })
        .addClass('small danger')
        .on('click', () => {
          const idx = categories.findIndex(c => c.code === cat.code);
          if (idx >= 0) {
            categories.splice(idx, 1);
            render();
          }
        });
      $li.append($del);
    } else {
      $li.append(' (in use)');
    }

    $list.append($li);
  });
}

let hasUnsavedChanges = false;

// Call this when something has been changed (e.g., task edited, added, etc.)
function markUnsavedChanges() {
  hasUnsavedChanges = true;
  $("#saveButton").prop("disabled", false);
}

// Clear flag after saving
function clearUnsavedChanges() {
  hasUnsavedChanges = false;
  $("#saveButton").prop("disabled", true);
}

// Warn user before closing
window.addEventListener("beforeunload", function (e) {
  if (!hasUnsavedChanges) return;
  // Required for Chrome and some modern browsers
  e.preventDefault();
  // Some browsers require this string (ignored but must be non-null)
  e.returnValue = "";
  // Others will use this message in legacy implementations
  return "You have unsaved changes. Are you sure you want to leave?";
});

// ==== FILTERS (Modal-based) ====
const FILTER_DIRECT = '__DIRECT__'; // pseudo-milestone for "has its own due date"
const activeFilters = {
  categories: new Set(),
  milestones: new Set(),
  searchText: ""
};

function matchesActiveFilters(task) {
  if (task.isBacklogDivider) return true; // always show divider

  // Category (OR within group)
  if (activeFilters.categories.size > 0) {
    if (!task.category || !activeFilters.categories.has(task.category)) return false;
  }

  // Milestone / Direct-driven (OR within group)
  if (activeFilters.milestones.size > 0) {
    const isDirectDriven = !!task.due && !task.milestoneId;
    const matchesDirect  = isDirectDriven && activeFilters.milestones.has(FILTER_DIRECT);
    const matchesMs      = !!task.milestoneId && activeFilters.milestones.has(String(task.milestoneId));
    if (!matchesDirect && !matchesMs) return false;
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

  return true;
}

function clearFilters(silent = false) {
  activeFilters.categories.clear();
  activeFilters.milestones.clear();
  activeFilters.searchText = "";
  $('#f-search').val('');
  // Uncheck all boxes if modal is open
  $('#filtersModalBody input[type="checkbox"]').prop('checked', false);
  updateFiltersButtonState();
  if (!silent) render();
  
}

function updateFiltersButtonState() {
  const hasActive = activeFilters.categories.size > 0 || 
                  activeFilters.milestones.size > 0 || 
                  (activeFilters.searchText.trim() !== "");
  $('#openFilters').toggleClass('active', hasActive);
}

// Build a human-readable summary of currently active filters
function getActiveFilterString() {
  const parts = [];

  // (optional) text search, if you added it earlier
  const hasSearchText = activeFilters.searchText && String(activeFilters.searchText).trim() !== "";
  if (hasSearchText) {
    parts.push(`Contains "${String(activeFilters.searchText).trim()}"`);
  }

  // categories
  if (activeFilters.categories && activeFilters.categories.size > 0) {
    const names = [...activeFilters.categories].map(code => {
      const c = categoryMap[code];
      return c ? c.name : code;
    });
    parts.push(`Category in [${names.join(", ")}]`);
  }

  // milestones (+ special DIRECT date pseudo-filter)
  if (activeFilters.milestones && activeFilters.milestones.size > 0) {
    const names = [...activeFilters.milestones].map(idStr => {
      if (idStr === FILTER_DIRECT) return "Direct-dated";
      const ms = milestoneMap[Number(idStr)];
      return ms ? ms.name : `Milestone ${idStr}`;
    });
    parts.push(`Milestone in [${names.join(", ")}]`);
  }

  if (parts.length === 0) return "No active filters. Showing all tasks.";
  return parts.join(" && ");
}

function buildFiltersModalUI() {
  const $body = $('#filtersModalBody');
  if ($body.length === 0) return;

  // Search text UI (NEW)
  const searchBoxHtml = `
    <label style="display:block; margin-bottom: .75rem;">
      <span>Match text in task or milestone</span>
      <input type="search" id="f-search" placeholder="e.g. design, MS2..." value="${activeFilters.searchText || ""}">
    </label>
  `;
  $body.html(searchBoxHtml); // start body with search box 

  // Categories
  const catItems = (categories || []).map(c => {
    const id = `f-cat-${c.code}`;
    return `
      <label style="display:flex; gap:.5rem; align-items:center;">
        <input type="checkbox" id="${id}" data-filter-type="category" value="${c.code}" ${activeFilters.categories.has(c.code) ? 'checked' : ''}>
        <span style="color:${c.color || 'inherit'}">${c.name} <small>(${c.code})</small></span>
      </label>`;
  }).join('');

  // Milestones (+ Direct-driven)
  const msItems = [
    `<label style="display:flex; gap:.5rem; align-items:center;">
       <input type="checkbox" id="f-ms-direct" data-filter-type="milestone" value="${FILTER_DIRECT}" ${activeFilters.milestones.has(FILTER_DIRECT) ? 'checked' : ''}>
       <span>Direct-driven <small>(has own due date)</small></span>
     </label>`,
    ...milestones
      .slice().sort((a,b)=>new Date(a.date)-new Date(b.date))
      .map(m => {
        const id = `f-ms-${m.id}`;
        const tent = m.tentative ? ' <small class="tentative">(tentative)</small>' : '';
        const dateSmall = m.date ? ` <small>(${m.date})</small>` : ' <small>(no date)</small>';
        return `
          <label style="display:flex; gap:.5rem; align-items:center;">
            <input type="checkbox" id="${id}" data-filter-type="milestone" value="${m.id}" ${activeFilters.milestones.has(String(m.id)) ? 'checked' : ''}>
            <span>${m.name}${dateSmall}${tent}</span>
          </label>`;
      })
  ].join('');

  $body.append(`
    <div style="display:grid; gap:1rem; margin-top:.25rem;">
      <fieldset>
        <legend style="margin-bottom:.25rem;">Category</legend>
        <div style="display:grid; gap:.25rem;">${catItems || '<small>(no categories)</small>'}</div>
      </fieldset>
      <fieldset>
        <legend style="margin-bottom:.25rem;">Milestone</legend>
        <div style="display:grid; gap:.25rem;">${msItems || '<small>(no milestones)</small>'}</div>
      </fieldset>
      <small class="contrast">Tip: selection is OR within each group, AND across groups.</small>
    </div>
  `);
}


$(document).ready(function () {  
  console.log("ONLOAD.")

  // INITIALISATION
  const $root = $('#container');
  $root.off('.app');
  
  render();
  clearUnsavedChanges();
  $("#saveButton").prop( "disabled", true )

  // benchmarkRender("Optimized Render", render, 20);

  // THESE ARE EVENT HANDLERS (DELEGATED TO $('#container'))
  $root
  .off('click.app', '#saveButton')
  .on('click.app', '#saveButton', function () {
    clearFilters(true);
    $("#filtersModalBody").html("");
    clearRenderedElements();
    $("#milestones details").prop("open", false);
    $("#allocate details").prop("open", true);
    $("#completedTasks details").prop("open", false);
    $(".toast").removeClass("show");
    $(".toast").remove();
    const html = `<!DOCTYPE html>\n` + document.documentElement.outerHTML.replace(
      /(?<=[<]!-- data --[>])[\s\S]*(?=[<]!-- end data --[>])/,
      `\n<script>` + 
      `\nsaveDate = "${nowString()}";` + 
      `\npageTitle = "${pageTitle}";` + 
      `\nbyLine = "${byLine}";` + 
      `\rrenderReadOnly = ${renderReadOnly};` + 
      `\nlogo = \`${logo}\`;` + 
      `\nconst allocationOptions = ${JSON.stringify(allocationOptions, null, 2)};` + 
      `\nconst milestones = ${JSON.stringify(milestones, null, 2)};` + 
      `\nconst tasks = ${JSON.stringify(tasks, null, 2)};` + 
      `\nconst categories = ${JSON.stringify(categories, null, 2)};` +   // <— add this
      `\n<\/script>\n`
    );
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let rawFilename = window.location.href.split('/').pop();
    rawFilename = rawFilename.split('?')[0].split('#')[0];
    a.download = rawFilename;
    a.click();
    URL.revokeObjectURL(a.href);
    
    console.log("Savefile created.")
    render();
    clearUnsavedChanges();
  });

  $root
  .off('click.app', '#confirmYes')
  .on('click.app', '#confirmYes', function () {
    if (typeof confirmCallback === 'function') confirmCallback();
    $('#confirmModal')[0].close();
  });

  $root
  .off('click.app', '#confirmNo')
  .on('click.app', '#confirmNo', function () {
    $('#confirmModal')[0].close();
  });


  $root
  .off('click.app', '#alertClose')
  .on('click.app', '#alertClose', function () {
    $('#alertModal')[0].close();
  });  


  $root
  .off('click.app', '#cancelEditModal')
  .on('click.app', '#cancelEditModal', function () {
    $('#taskEditModal')[0].close();
  });
  
  // Open Filters modal
  $root
    .off('click.app', '#openFilters')
    .on('click.app', '#openFilters', function () {
      buildFiltersModalUI();
      $('#filtersModal')[0].showModal();
    });

  // wire search box
  $root.off('input', '#f-search').on('input', '#f-search', (e) => {
    activeFilters.searchText = e.target.value || "";
    updateFiltersButtonState();
    render();
  });

  // Close Filters modal
  $root
    .off('click.app', '#filtersCloseBtn')
    .on('click.app', '#filtersCloseBtn', function () {
      $('#filtersModal')[0].close();
    });

  // Clear filters
  $root
    .off('click.app', '#filtersClearBtn')
    .on('click.app', '#filtersClearBtn', function () {
      clearFilters(); // also re-renders
    });

  // Checkbox changes (delegated)
  $root
    .off('change.app', '#filtersModalBody input[type="checkbox"]')
    .on('change.app', '#filtersModalBody input[type="checkbox"]', function () {
      const type = $(this).data('filter-type');
      const val  = String($(this).val());
      const set  = (type === 'category') ? activeFilters.categories : activeFilters.milestones;
      this.checked ? set.add(val) : set.delete(val);
      render();
    });


  $root
  .off('click.app', '#saveEditedTask')
  .on('click.app', '#saveEditedTask', function () {
    const id = parseInt($(this).attr("data-saveitemid"));
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Get new values
    const name = $('#taskName').val().trim();
    const due = $('#taskDue').val();
    const milestoneIdRaw = $('#taskMilestone').val();
    const milestoneId = milestoneIdRaw ? parseInt(milestoneIdRaw) : null;
    const category = $('#taskCategory').val().trim() || null;    

    if (!name) {
      showAlertModal("Please enter a task name.", "Task Update");
      return;
    }

    task.text = name;
    task.due = milestoneId ? null : due; // If milestone selected, clear due date
    if (task.due === "") { task.due = null; }
    task.milestoneId = milestoneId;
    task.category = category;

    task['link-conf'] = $('#confluenceUrl').val();
    task['link-jira'] = $('#jiraUrl').val();
    task['link-other'] = $('#otherUrl').val();
    task.completed = $('#taskCompleted').is(":checked");
    task.assignedTo = $("#taskAssigned").val() || null; // NEW LINE

    $('#taskEditModal')[0].close();

    console.log(`Task '${name}' edited via modal.`)
    render();

  });

  // Smooth scroll for #sidebar anchor clicks (targeting <main>)
  $root
  .off('click.app', '#sidebar a[href^="#"]')
  .on('click.app', '#sidebar a[href^="#"]', function (e) {
    e.preventDefault();
    const targetId = $(this).attr('href').substring(1);
    const $target = $('#' + targetId);
    const $main = $('main');
    if ($target.length) {
      const offsetTop = $target.position().top + $main.scrollTop();
      $main.animate({ scrollTop: offsetTop }, 400);
      // Prevent hash in URL
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
  });

  $root
  .off('click.app', '#addMilestone')
  .on('click.app', '#addMilestone', function () {

    const addBtn = document.getElementById("addMilestone");
    const nameInput = addBtn.parentElement.querySelector('.ms-name');
    const dateInput = addBtn.parentElement.querySelector('.ms-date');

    const name = nameInput.value.trim();
    const date = dateInput.value;

    if (!name) {
      showAlertModal("Please enter a name for the milestone.", "Milestone Creation");
      return;
    }

    const newId = generateUniqueMilestoneId();
    milestones.push({ id: newId, name, date });

    nameInput.value = '';
    dateInput.value = '';

    console.log(`Milestone '${name}' added.`)
    render();
  });

  $root
  .off('click.app', '.addTask')
  .on('click.app', '.addTask', function () {
    const $group = $(this).closest('[role="group"]');
    const nameInput = $group.find('.tsk-name')[0];
    const milestoneSelect = $group.find('.tsk-milestone')[0];
    const dateInput = $group.find('.tsk-date')[0];
    const categorySelect = $group.find('.tsk-category')[0];

    const name = (nameInput?.value || "").trim();
    const milestoneId = milestoneSelect?.value ? parseInt(milestoneSelect.value) : null;
    const date = dateInput?.value || null;
    const category = categorySelect?.value || null;

    if (!name) {
      showAlertModal("Please enter a name.", "Task Creation");
      return;
    }

    const assignedTo = $(this).data('allocation') || null; // auto-assign to section

    const newId = generateUniqueTaskId();
    tasks.push({
      id: newId,
      text: name,
      due: milestoneId ? null : date,
      milestoneId,
      assignedTo,
      category,
      priority: normalizeAndGetNextPriority()
    });

    // clear only this group's inputs
    if (nameInput) nameInput.value = '';
    if (milestoneSelect) milestoneSelect.value = '';
    if (dateInput) dateInput.value = '';
    if (categorySelect) categorySelect.value = '';

    console.log(`Task '${name}' added${assignedTo ? ` (allocated to ${assignedTo})` : ''}.`);
    render();
  });

  $root
  .off('blur.app keypress.app', '.ms-name, .ms-date')
  .on('blur.app', '.ms-name, .ms-date', function () {
    const milestoneId = parseInt($(this).attr('data-milestoneid'));
    const milestone = milestones.find(m => m.id === milestoneId);
    if (milestone) {
      const nameInput = document.querySelector(`.ms-name[data-milestoneid="${milestoneId}"]`);
      const dateInput = document.querySelector(`.ms-date[data-milestoneid="${milestoneId}"]`);
      const oldName = milestone.name;
      const oldDate = milestone.date;
      const newName = nameInput.value;
      const newDate = dateInput.value;

      // Only update if something changed
      if (oldName !== newName || oldDate !== newDate) {
        milestone.name = newName;
        milestone.date = newDate;

        console.log(`Milestone edited (on blur): ${newName} | ${newDate}.`);
        showToast("Milestone updated and tasks adjusted.", "success");
        render();
      }
    }
  })
  .on('keypress.app', '.ms-name, .ms-date', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      $(this).blur(); // triggers the blur handler above
    }
  });

  $root
  .off('click.app', '.task .delete')
  .on('click.app', '.task .delete', function () {
    const $task = $(this).closest('.task');
    const taskId = parseInt($task.attr('data-itemid'), 10);
    deleteTask(taskId);
  });

  $root
  .off('click', '.open-task-edit-modal')
  .on('click', '.open-task-edit-modal', function () {
    const triggerElement = $(this);
    const id = parseInt(triggerElement.closest('.task').attr("data-itemid"));
    const task = tasks.find(t => t.id === id);
    const modal = $('#taskEditModal');

    modal.find('.itemName').text(task.text);
    modal.find('#saveEditedTask').attr("data-saveitemid", id);

    modal.find('#confluenceUrl').val(task['link-conf'] || "");
    modal.find('#jiraUrl').val(task['link-jira'] || "");    
    modal.find('#otherUrl').val(task['link-other'] || "");
    modal.find('#taskName').val(task.text);
    modal.find('#taskDue').val(task.due || "");
    modal.find('#taskCategory').val(task.category || "");
    modal.find('#taskCompleted').prop("checked", !!task.completed);

    const select = modal.find('#taskMilestone');
    select.html(`<option value="">-- Select milestone (optional) --</option>`);
    milestones
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(ms => {
        const opt = $(`<option>`).val(ms.id).text(`${ms.name} (${ms.date})`);
        if (task.milestoneId == ms.id) opt.prop("selected", true);
        select.append(opt);
      });

      // Populate Allocated To
      const $assigned = $("#taskAssigned");
      $assigned.empty().append(`<option value="">Unallocated</option>`);
      // allocationOptions.forEach(opt => {
      allocationOptions.forEach(opt => {
        const name = getAllocationName(opt);
        const type = getAllocationType(opt);
        const label = type ? `${name} — ${type}` : name;
        $assigned.append(
          // `<option value="${opt}" ${task.assignedTo === opt ? "selected" : ""}>${opt}</option>`
          `<option value="${name}" ${task.assignedTo === name ? "selected" : ""}>${label}</option>`
        );
      });

    modal[0].showModal();
  });

  $root
  .off('click', '.task .complete')
  .on('click', '.task .complete', function () {
    const taskId = $(this).data("taskid");
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newState = !task.completed;
    const verb = newState ? "Completed" : "Incomplete";

    showConfirmModal(
      `Mark task "${task.text}" as ${verb}?`,
      () => {
        task.completed = newState;
        console.log(`Task '${task.text}' marked ${verb}.`);
        render();
      },
      `Mark as ${verb}`
    );
  });

  $root
  .off('click.app', '#existingAllocationsList .del-allocation')
  .on('click.app', '#existingAllocationsList .del-allocation', function () {
    // const option = $(this).data('option');
    // removeAllocationByName(option);
    const option = $(this).data('option') || $(this).attr('data-option');
    upgradeAllocationOptionsInPlace();
    removeAllocationByName(option);
    console.log(`Allocation option '${option}' removed.`);
    markUnsavedChanges();
    render();
    updateAllocationList();
  });

  $root
  .off('click.app', '#existingAllocationsList .save-allocation')
  .on('click.app', '#existingAllocationsList .save-allocation', function () {
    const oldName = $(this).data('old') || $(this).attr('data-old');
    const $li = $(this).closest('li');
    const newName = ($li.find('.alloc-edit-name').val() || '').trim();
    const newType = ($li.find('.alloc-edit-type').val() || '').trim();

    if (!newName) {
      showAlertModal("Name cannot be empty.", "Allocation Management");
      return;
    }

    upgradeAllocationOptionsInPlace();

    // Prevent duplicates if renaming
    if (newName !== oldName && hasAllocationName(newName)) {
      showAlertModal("That allocation name already exists.", "Allocation Management");
      return;
    }

    const idx = allocationOptions.findIndex(o => getAllocationName(o) === oldName);
    if (idx < 0) return;

    allocationOptions[idx].name = newName;
    allocationOptions[idx].type = newType;

    // If renamed, update tasks assignedTo
    if (newName !== oldName) {
      renameAllocationEverywhere(oldName, newName);
    }

    markUnsavedChanges();
    render();
    updateAllocationList();
  });

  $root
  .off('click.app', '.delete-milestone')
  .on('click.app', '.delete-milestone', function () {
    const msId = Number($(this).data("milestoneid"));
    const mode = String($(this).data("mode") || "unused");

    if (mode === "all-complete") {
      deleteMilestoneWhenAllComplete(msId);
    } else {
      // Reuse your existing path
      deleteMilestone(msId);
    }
  });


  $root
  .off('click.app', '.tentative-btn')
  .on('click.app', '.tentative-btn', function () {
    const id = parseInt(this.dataset.milestoneid, 10);
    const ms = milestones.find(m => m.id === id);
    if (ms) {       
      ms.tentative = !ms.tentative; 
      if (ms.tentative){ console.log(`Milestone '${ms.name}' set to tentative.`) }
      else { console.log(`Milestone '${ms.name}' set to NOT tentative.`) }
      render(); 
    }
  });

  $root
  .off('click.app', '#exportButton')
  .on('click.app', '#exportButton', function () {
    clearFilters(true);
    render();
    $("#filtersModalBody").html("");
    exportHTMLSummary();
  });

  $root
  .off('click.app', '#openAboutModal')
  .on('click.app', '#openAboutModal', e => { 
    e.preventDefault();
    $('#aboutModal')[0].showModal();
  });

  $root
  .off('click.app', '#closeAboutModal')
  .on('click.app', '#closeAboutModal', function () {
    $('#aboutModal')[0].close();
  });

  $root
  .off('click.app', '#manageAllocations')
  .on('click.app', '#manageAllocations', function () {    
    upgradeAllocationOptionsInPlace();
    updateAllocationList();
    $('#allocationModal')[0].showModal();
  });

  $root
  .off('click.app', '#closeAllocationModal')
  .on('click.app', '#closeAllocationModal', function () {
    $('#allocationModal')[0].close();
  });

  $root
  .off('click.app', '#addAllocationOption')
  .on('click.app', '#addAllocationOption', function () {
    const newName = $('#newAllocationInput').val().trim();
    const newType = ($('#newAllocationTypeInput').val() || '').trim();
    if (!newName) return;

    upgradeAllocationOptionsInPlace();

    if (hasAllocationName(newName)) {
      showAlertModal("That allocation already exists.", "Allocation Management");
      return;
    }

    allocationOptions.push({ name: newName, type: newType });
    $('#newAllocationInput').val('');
    $('#newAllocationTypeInput').val('');
    markUnsavedChanges();
    render();
    updateAllocationList();
  });

  $root
  .off('click.app', '#manageCategories')
  .on('click.app', '#manageCategories', function () {
    // updateCategoryList();
    $('#categoryModal')[0].showModal();
  });

  $root
  .off('click.app', '#closeCategoryModal')
  .on('click.app', '#closeCategoryModal', function () {
    $('#categoryModal')[0].close();
  });

  $root
  .off('click.app', '#addCategory')
  .on('click.app', '#addCategory', function () {
    const code = $('#newCatCode').val().trim().toUpperCase();
    const name = $('#newCatName').val().trim() || code;
    const color = $('#newCatColor').val();
    if (!code || categories.some(c => c.code === code)) {
      showAlertModal("Please provide a unique category code.", "Categories");
      return;
    }
    categories.push({ code, name, color });
    $('#newCatCode').val(''); $('#newCatName').val('');
    render();
  });

  // end of delegated handlers

  $('#pageTitle').editable('destroy');
  $('#pageTitle').editable({
    touch : true,
    lineBreaks : false,
    toggleFontSize : false, 
    closeOnEnter : true,
    emptyMessage : 'Title',
    callback : function( data ) {
      if( data.content ) { 
        pageTitle = data.content; 
        
        console.log("Page title updated.")
        render();
      }
      data.$el.removeAttr("data-edit-event");
      data.$el.removeAttr("style");
    }
  });

  if ($("html").data("theme") == "dark"){
    $("div.theme-toggle").addClass("theme-toggle--toggled") 
  } else { $("div.theme-toggle").removeClass("theme-toggle--toggled") }


  // diagnostic
  // document.addEventListener('click', function (e) {
  //   console.log(
  //     'CLICK:',
  //     e.target,
  //     'bubbled to',
  //     e.currentTarget
  //   );
  // }, true); // <-- capture phase so we see it before bubbling





});

