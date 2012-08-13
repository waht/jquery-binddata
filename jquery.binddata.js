(function( $ ) {
    var getPropValue = function(bean, propname) {
        var props = propname.split('.');
        var val = bean;
        for (var i = 0; i < props.length; i++) {
            val = val[props[i]];
        }
        return val;
    };

    var setPropValue = function(bean, propname, value) {
        var props = propname.split('.');
        var obj = bean;
        for (var i = 0; i < props.length; i++) {
            if (i + 1 >= props.length) {
                obj[props[i]] = value;
            }
            else {
                if (null == obj[props[i]]) {
                    obj[props[i]] = {};
                }
                obj = obj[props[i]];
            }
        }
    };

    var getPropNamesAndValues = function(bean, propPrefix, ret) {
        for (var prop in bean) {
            var propname = (propPrefix) ? propPrefix + '.' + prop : prop;
            var type = typeof(bean[prop]);
            if ('object' === type) {
                ret = getPropNamesAndValues(bean[prop], propname, ret);
            }
            else if ('function' === type) {
            }
            else {
                if (ret == null) ret = {};
                ret[propname] = getPropValue(bean, prop);
            }
        }

        return ret;
    };

    var getElementType = function($el) {
        var type = $el.prop('type');    //in IE this returns select-one
        if ($el.is("select") || type == null) {
            type = $el[0].tagName.toLowerCase();
        }
        return type;
    };

    var changeHandler = function() {
        var type = getElementType($(this));
        var bean = $(this).data('bindData.data').bean;
        var transforms = $(this).data('bindData.data').transforms;
        var propname = $(this).attr('name');
        var value = null;
        switch (type) {
            case 'checkbox':
                value = $(this).is(':checked');
                break;
            default:
                value = $(this).val();
                break;
        }
        value = applyTransforms('get', value, getTransformsForField(propname, transforms));
        setPropValue(bean, propname, value);
    };

    var getTransformsForField = function(name, transforms) {
        var ret = [];
        $.each(transforms, function(index, transform) {
            if (transform.name.test(name)) {
                ret.push(transform.getset);
            }
        });
        return ret;
    };

    var applyTransforms = function(type, value, transforms) {
        var ret = value;
        $.each(transforms, function(index, transform) {
            ret = transform(type, ret);
        });
        return ret;
    };

    var setFormFields = function($form, data, transforms) {
        for (var prop in data) {
            var propTransforms = getTransformsForField(prop, transforms);
            var value = applyTransforms('set', data[prop], propTransforms);
            setFormField($form, prop, value);
        }
    };

    var getFormFields = function($form, data, transforms) {
        var getFieldData = function(index, el) {
            var name = $(el).attr('name');
            var type = getElementType($(el));
            var val = null;
            switch (type) {
                case 'hidden':
                case 'text':
                case 'select':
                    val = $(el).val();
                    break;
                case 'radio':
                    if ($(el).is(':checked')) {
                        val = $(el).val();
                    }
                    else {
                        return;
                    }
                    break;
                case 'checkbox':
                    val = $(el).is(':checked');
                    break;
            }
            val = applyTransforms('get', val, getTransformsForField(name, transforms));
            setPropValue(data, name, val);
        };
        $form.find('input').each(getFieldData);
        $form.find('select').each(getFieldData);
    };

    var setFormField = function($form, name, value) {
        var $el = $form.find('[name="'+name+'"]');
        if ($el.length == 0) return;    //Abort if $el was not found
        var type = getElementType($el);

        switch (type) {
            case 'hidden':
            case 'text':
            case 'select':
                $el.val(value);
                break;
            case 'radio':
                $el.filter('[value="'+value+'"]').prop('checked', true);
                break;
            case 'checkbox':
                if (true === value) {
                    $el.prop('checked', true);
                }
                else {
                    $el.prop('checked', false);
                }
                break;
        }
    };

    $.fn.binddata = function(bean, properties) {
        var method;
        var methodUpdate = false;
        var methodUnbind = false;
        
        if (null == bean) {
            return this;
        }
        
        //Determine method from bean argument
        if (typeof bean === "string") {
            method = bean;
            bean = this.data('bindData.bean');
            properties = this.data('bindData.properties');
        }
        if (method !== undefined) {
            if (this.data('bindData.bean') === undefined) {
                throw {message:'Please call binddata(data, [properties]) first!'};
            }
            //Set method flags
            methodUpdate = (method == "update");
            methodUnbind = (method == "unbind");
            if (!methodUpdate && !methodUnbind) {
                throw {message:'Unsupported method!'};
            }
        }
        
        var _this = this;
        var defaultProperties = {
            bindAll: true,
            onlyGetOrSet: '',
            transforms: [],
            autoUnbind: true
        };
        $.extend(defaultProperties, properties);
        var data = getPropNamesAndValues(bean);
        
        if (this.data('bindData.bean') !== undefined && !methodUnbind && !defaultProperties.autoUnbind) {
            throw {message:'Multiple data binding not supported. Please call binddata("unbind") first!'};
        }
        
        //Store last used bean in container
        if (typeof bean === "object") {
            this.data('bindData.bean', bean);
        }
        this.data('bindData.properties', defaultProperties);
        
        //Remove bean and properties from container
        if (methodUnbind) {
            this.removeData('bindData.bean');
            this.removeData('bindData.properties');
        }

        switch (defaultProperties.onlyGetOrSet) {
            case 'set':
                setFormFields(this, data, defaultProperties.transforms);
                return this;
            case 'get':
                getFormFields(this, bean, defaultProperties.transforms);
                return this;
        }

        var elData = {bean: bean, transforms: defaultProperties.transforms};
        
        var bindHandler = function ($el) {
            //Bind handler (doUpdate-flag omits binding if already bound)
            if (!methodUpdate || (methodUpdate && $el.data('bindData.data') === undefined)) {
                $el.data('bindData.data', elData);
                $el.on('change', changeHandler);
            }
        };
        var unbindHandler = function ($el) {
            if ($el.data('bindData.data') !== undefined) {
                    $el.removeData('bindData.data');
                    $el.off('change', changeHandler);
            }
        };
        
        //Remove existing handlers before binding
        if (defaultProperties.autoUnbind && !methodUpdate) {
            var doUnbind = function(index, el) {
                unbindHandler($(el));
            };
            this.find('input').each(doUnbind);
            this.find('select').each(doUnbind);
        }
        
        if (defaultProperties.bindAll === false) {
            for (var prop in data) {
                var $el = this.find('[name="'+prop+'"]');
                if (!methodUnbind) {
                    bindHandler($el);
                } else {
                   unbindHandler($el);
                }
            }
            setFormFields(this, data, elData.transforms);
        }
        else {
            var doBind = function(index, el) {
                var $el = $(el);
                if (!methodUnbind) {
                    bindHandler($el);
                } else {
                   unbindHandler($el);
                }
            };
            this.find('input').each(doBind);
            this.find('select').each(doBind);
            setFormFields(this, data, elData.transforms);
        }
        
        return this;
    };
})(jQuery);
