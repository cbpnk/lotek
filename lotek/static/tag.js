import {AutoCompleteInput} from "/static/autocomplete.js";
import {Title} from "/static/view.js";

const Widget = {
    view: function(vnode) {
        return [
            m("h4", "Tags"),
            m(AutoCompleteInput,
              {paths: vnode.attrs.doc.tag_i,
               query: "category_i:tag",
               attribute: "tag_i",
               patch: vnode.attrs.patch,
               addon: "Tag",
               popover: "popover-left",
              }
             )
        ];
    }
}

const TagForm = {
    view: function(vnode) {
        return m(m.route.Link,
                {href: m.buildPathname("/search/", {q: `tag_i:${vnode.attrs.path}`})},
                "tagged with ", m(Title, {doc: vnode.attrs.doc})
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

export const right_widgets = [Widget];
