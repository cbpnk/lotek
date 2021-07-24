const Editor = {
    view: function(vnode) {
        function onclick(event) {
            vnode.attrs.save();
        }

        return [
            m("aside.top",
              m("div.form-horizontal",
                m("div.form-group",
                  m("div.column.col-3", m("label.form-label", "Revision")),
                  m("div.column", m("label.form-label", (vnode.attrs.doc.revision_n || [0])[0])),
                  m("div",
                    m("button.btn.btn-primary", {onclick}, "Save")
                   )
                 )
               )
             ),
            m("div",
              {"style": "grid-column: 1 / span 3; margin: 1em;"},
              m("iframe",
                {style: "margin: 0 auto; width: 100%; height: 100%;",
                 src: EDITOR_URL + m.buildPathname("/docs/:token", {token: vnode.attrs.doc.feishu_token_i[0]})})
             )
        ];
    }
}

export const editor_widgets = [Editor];
