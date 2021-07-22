import {AutoCompleteInput} from "/static/autocomplete.js";
import {Title} from "/static/view.js";

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

const TagForm = {
    view: function(vnode) {
        return m("div.form-horizontal",
            m("div.form-group",
              m(m.route.Link,
                {href: m.buildPathname("/search/", {q: `tag_i:${vnode.attrs.path}`}),
                 "class": "form-input btn btn-primary"},
                "Tagged By ", m(Title, {doc: vnode.attrs.doc})
               )
             )
        );
    }
}

export const searches = [{name: "Tags", query: "category_i:tag"}];
export const categories = {
    tag: {
        name: "Tag",
        component: TagForm,
    }
};

export const top_widgets = [Widget];
