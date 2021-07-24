import {Title} from "/static/view.js";

const Editor = {
    view: function(vnode) {
        function onsubmit(event) {
            event.preventDefault();
            let form = new FormData(event.target);
            let title = form.get("title");
            let content = form.get("content");
            let patch = [{op: "replace", path: "/content", value: content}];
            if (title.length > 0) {
                if (vnode.attrs.doc.title_t) {
                    patch.push({op: "replace", path: "/title_t/0", value: title});
                } else {
                    patch.push({op: "add", path: "/title_t", value: [title]});
                }
            } else {
                if (vnode.attrs.doc.title_t) {
                    patch.push({op: "remove", path: "/title_t"})
                }
            }

            vnode.attrs.patch(
                patch
            ).then(
                function() {
                    vnode.attrs.hide();
                }
            );
        }

        return [
            m("form.d-flex",
              {"style": "flex-direction: column; grid-area: main; margin: 1em;",
               onsubmit},
              m("h2.input-group",
                m("input.form-input[name='title'][placeholder='Title']",
                  {value: (vnode.attrs.doc.title_t || [""])[0]}),
                m("button.input-group-btn.btn.btn-primary", "Save"),
                m("button.btn.input-group-btn",
                  {onclick: function(event) {
                      event.preventDefault();
                      vnode.attrs.hide();
                  }},
                  "Cancel")
               ),
              m("textarea[name='content']",
                {"style": "margin: 0 auto; width: 100%; height: 100%;"},
                vnode.attrs.doc.content))
        ];
    }
}


export const editor_widgets = [Editor];
