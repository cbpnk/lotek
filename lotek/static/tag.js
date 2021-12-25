import {AutoCompleteInput} from "/static/autocomplete.js";

const Widget = {
    view: function(vnode) {
        return m("details", {open: true},
                 m("summary", "TAG"),
                 m(AutoCompleteInput,
                   {ids: vnode.attrs.file.tag_r,
                    query: "category_s:tag",
                    attribute: "tag_r",
                    patch: vnode.attrs.patch,
                    placeholder: "Add tags ...",
                   }
                  )
                );
    }
};

const TagForm = {
    view: function(vnode) {
        return m(m.route.Link,
                 {href: m.buildPathname("/search/", {q: `tag_r:${vnode.attrs.path}`})},
                 "tagged with ", vnode.attrs.file.name || "Untitled");
    }
};

export const searches = [{name: "Tags", query: "category_s:tag"}];
export const categories = {
    tag: {
        name: "Tag",
        component: TagForm
    }
};

export const widgets = [Widget];
