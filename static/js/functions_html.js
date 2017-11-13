// functions specifically for interacting with the HTML (both upon start up and during sessions)

// add a new filter
function addFilter() {
	// get filter count
	var filter_count = document.getElementById('accordion-filters').children.length - 1;
	// get base filter id and last filter id
	var filter_id_base = 'filter0';
	var filter_id_last = 'filter' + filter_count;
	// get base filter and last filter
	var base_filter = $('#' + filter_id_base + '-panel');
	var last_filter = $('#' + filter_id_last + '-panel');
	// clone base filter
	var clone = base_filter.clone(false);
	// update filter count
	filter_count ++;
	// create new filter id
	var filter_id_new = 'filter' + filter_count;
	// update id of clone
	clone.attr('id', clone.attr('id').replace(filter_id_base, filter_id_new));
	// update all ids of elements within clone
	clone.find('*[id]').each(function() {
		$(this).attr('id', $(this).attr('id').replace(filter_id_base, filter_id_new));
	});
	// update href of elements within clone
	clone.find('*[href]').each(function() {
		$(this).attr('href', $(this).attr('href').replace(filter_id_base, filter_id_new));
	});
	// update all names of elements within clone
	clone.find('*[name]').each(function() {
		$(this).attr('name', $(this).attr('name').replace(filter_id_base, filter_id_new));
	});
	// update title of clone
	clone.find('#panel-title-' + filter_id_new + ' a').text('Filter ' + filter_count + ':');
	clone.find('#panel-title-' + filter_id_new).find('.panel-title-filter-edit').text('custom');
	// set clone to be collapsed by default
	clone.find('#collapse-' + filter_id_new).attr('class', 'panel-collapse collapse');
	// update onclick functions within clone
	clone.find('#button-buildings-values-' + filter_id_new)[0].outerHTML = clone.find('#button-buildings-values-' + filter_id_new)[0].outerHTML.replace(filter_id_base, filter_id_new);
	clone.find('#button-roads-values-' + filter_id_new)[0].outerHTML = clone.find('#button-roads-values-' + filter_id_new)[0].outerHTML.replace(filter_id_base, filter_id_new);
	clone.find('#button-water-values-' + filter_id_new)[0].outerHTML = clone.find('#button-water-values-' + filter_id_new)[0].outerHTML.replace(filter_id_base, filter_id_new);
	// add clone as new filter
	clone.insertAfter(last_filter);
}

function removeFilterTypeEntry() {
	var temp_id = this.id;
	// get current filter number
	var temp_filter_id = String(temp_id).slice(0, temp_id.indexOf('-'));
	// get current filter type
	var temp_filter_type = String(temp_id).slice(temp_filter_id.length+1, temp_id.lastIndexOf('-'));
	// get current entry type
	var temp_entry_type = String(temp_id).slice(temp_id.lastIndexOf('-')+1).replace(/[0-9]/g, '');
	// get current row number
	var temp_row_nr = String(temp_id).slice(temp_id.indexOf(temp_entry_type)+temp_entry_type.length) - 1;
	// get current table body (parent)
	var temp_table = document.getElementById('list-' + temp_filter_type + '-' + temp_entry_type + 's-' + temp_filter_id).children[0];
	// get current row element (child)
	var temp_row = temp_table.children[temp_row_nr];
	// remove row element
	temp_table.removeChild(temp_row);
}

function addFilterValue(temp_filter_id, key) {
	// get current filter number
	//var temp_filter_id = String(this.id).replace('button-buildings-values-', '');
	// get current table entries
	//var temp_item = document.getElementById('list-buildings-values-' + temp_filter_id).children[0];
	var temp_item = document.getElementById('list-' + key + '-values-' + temp_filter_id).children[0];
	// get table entry count and add 1
	var temp_count = temp_item.children.length + 1;
	// create new elements and set attributes
	var add_item  = document.createElement('tr');
	var add_item2 = document.createElement('td');
	var add_item3 = document.createTextNode(temp_count + '. ');
	var add_item4 = document.createElement('input');
	add_item4.type = 'text';
	add_item4.className = 'input-text-filter form-control';
	//add_item4.name = temp_filter_id + '-buildings-value' + temp_count;
	add_item4.name = temp_filter_id + '-' + key + '-value' + temp_count;
	add_item4.placeholder = '< enter value here >';
	var add_item5 = document.createElement('td');
	var add_item6 = document.createElement('button');
	add_item6.className = 'remove-list-item-button btn';
	//add_item6.id = temp_filter_id + '-buildings-value' + temp_count
	add_item6.id = temp_filter_id + '-' + key + '-value' + temp_count;
	add_item6.addEventListener('click', removeFilterTypeEntry);
	var add_item7 = document.createTextNode('x');
	// add elements together
	add_item6.appendChild(add_item7);
	add_item5.appendChild(add_item6);
	add_item2.appendChild(add_item3);
	add_item2.appendChild(add_item4);
	add_item.appendChild(add_item2);
	add_item.appendChild(add_item5);
	// add complete element to current table
	temp_item.appendChild(add_item);
}