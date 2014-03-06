//element_attribute class
var type_id, value_id, 

function ElementAttribute(type_id, value_id)
{
	this.type = null; 
	this.value = null; 
	this.type_id = type_id; 
	this.value_id = value_id; 

	this.__defineGetter__("type", function(){
		if (this.type != null) {
			this.type = getTypeById(this.type_id).type;
		}
		return this.type;
	});

	this.__defineSetter__("type", function(val){
		if (this.type != null) {
			this.type = val;
		}
	});

	this.__defineGetter__("value", function(){
		if (this.value != null) {
			this.value = getValueById(this.value_id).value;
		}
		return this.type;
	});

	this.__defineSetter__("value", function(val){
		if (this.value != null) {
			this.value = val;
		}
	});
}




