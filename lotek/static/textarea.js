import {Title} from "/static/view.js";

const Widget = {
    view: function(vnode) {
        function onclick(event) {
            m.route.set(m.buildPathname("/edit/:path...", {path: vnode.attrs.path}));
        }
        return (vnode.attrs.edit)?null:
            [m("div.divider", {"data-content": "TextArea"}),
             m("div.form-horizontal",
               m("div.form-group",
                 m("div.column",
                   m("button.btn.btn-primary.float-right", {onclick}, "Edit"))
                )
              )
            ];
    }
};

const Editor = {
    oninit: function(vnode) {
        vnode.state.content = vnode.attrs.doc.content;
    },

    view: function(vnode) {
        function oninput(event) {
            vnode.state.content = event.target.value;
        }
        function onclick(event) {
            vnode.attrs.patch(
                [{op: "replace", path: "/content", value: vnode.state.content}]
            ).then(
                function() {
                    m.route.set(m.buildPathname("/view/:path...", {path: vnode.attrs.path}));
                }
            );
        }

        return [
            m("aside.top",
              m("h2", m(Title, {doc: vnode.attrs.doc}),
                m("div.input-group.float-right",
                  m("button.input-group-btn.btn.btn-primary", {onclick}, "Save"),
                  m(m.route.Link,
                    {"class": "btn input-group-btn",
                     "href": m.buildPathname("/view/:path...", {path: vnode.attrs.path})
                    },
                    "Cancel")
                 )
               )
             ),
            m("main",
              m("textarea",
                {"style": "margin: 0 auto; width: 100%; height: 100%;", oninput},
                vnode.state.content))
        ];
    }
}


export const editor_widgets = [Editor];
export const top_widgets = [Widget];
