import {levenshteinEditDistance} from "https://unpkg.com/levenshtein-edit-distance/index.js";

export const AutoCompleteInput = {
    oninit: function(vnode) {
        vnode.state.value = "";

        m.request(
            {method: "POST",
             url: "/search/",
             body: {q: vnode.attrs.query}}
        ).then(
            function(result) {
                vnode.state.items = Object.fromEntries(result.map((item) => [item.path, item]));
                m.redraw();
            },
            function(error) {
                console.log(error);
            }
        );

    },

    view: function(vnode) {
        const autocomplete_items = Object.values(
            vnode.state.items || {}
        ).filter(
            (item) =>
            !(vnode.attrs.paths || []).includes(item.path));

        function oninput(e) {
            vnode.state.value = e.target.value;
            let items = autocomplete_items.map(
                (item) =>
                [levenshteinEditDistance(
                    (item.title_t || [""])[0],
                    vnode.state.value),
                 item]
            );
            items.sort((a,b) => a[0] < b[0]);
            items.slice(9);
            vnode.state.suggests = items.map(([_, item]) => item);
        }

        function add_path(path) {
            vnode.attrs.patch(
                (vnode.attrs.paths)?
                [{op: "add", path: `/${vnode.attrs.attribute}/-`, value: path}]
                :
                [{op: "add", path: `/${vnode.attrs.attribute}`, value: [path]}]
            );
            vnode.state.value = "";
        }

        function remove_path(path) {
            vnode.attrs.patch(
                [{op: "remove", path: `/${vnode.attrs.attribute}/${vnode.attrs.paths.indexOf(path)}`}]
            );
        }

        if (!vnode.state.items) {
            return m("div.input-group.form-autocomplete",
                     (vnode.attrs.addon)?m("span.input-group-addon", vnode.attrs.addon):null,
                     m("div.form-autocomplete-input.form-input",
                       m("div.has-icon-left",
                         m("input.form-input"),
                         m("i.form-icon.loading"))
                      )
                    );
        }

        return m("div.input-group.form-autocomplete",
                 (vnode.attrs.addon)?m("span.input-group-addon", vnode.attrs.addon):null,
                 m("div.form-autocomplete-input.form-input",
                   (vnode.attrs.paths || []).map(
                       (path) =>
                       m("div.popover",
                         m("div.chip",
                           (vnode.state.items[path].title_t || ["Untitled"])[0],
                           m("button.btn.btn-clear", {onclick: function() {remove_path(path);}})),
                         m("div.popover-container",
                           m("div.card",
                             m("div.card-header",
                               m("div.card-title.h5", (vnode.state.items[path].title_t || ["Untitled"])[0]),
                               m("div.card-subtitle", path)
                              )
                            )
                          )
                        )
                   ),
                   m("input.form-input[type=text]", {oninput, value: vnode.state.value})),
                 (vnode.state.value==="")?
                 []
                 :
                 m("ul.menu",
                   vnode.state.suggests.map(
                       (suggest) =>
                       m("li.menu-item",
                         m("a", {onclick: function() {add_path(suggest.path);}},
                           m("div.tile",
                             m("div.tile-content",
                               m("div.tile-title.text-bold", (suggest.title_t || ["Untitled"])[0]),
                               m("div.tile-subtitle", suggest.path)
                              )
                            )
                          )
                        ))
                  )
                );

    }
}
