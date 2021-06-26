import {AutoCompleteInput} from "/static/autocomplete.js";

const Widget = {
    view: function(vnode) {
        return (vnode.attrs.edit)?null:
            [m("div.divider", {"data-content": "Tags"}),
             m(AutoCompleteInput,
               {paths: vnode.attrs.doc.tag_i,
                query: "category_i:tag",
                attribute: "tag_i",
                patch: vnode.attrs.patch,
               }
              )];
    }
}

export const searches = [{name: "Tags", query: "category_i:tag"}];
export const categories = {tag: {name: "Tag"}};

export const top_widgets = [Widget];
