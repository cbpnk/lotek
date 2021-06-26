const CategoryTabs = {
    oninit: function(vnode) {
        vnode.state.active = (vnode.attrs.doc.category_i || [])[0];
    },

    view: function(vnode) {
        const new_categories = Object.entries(registry.categories).filter(
            ([key, value]) => !(vnode.attrs.doc.category_i || []).includes(key));

        function delete_category(category) {
            return function() {
                vnode.attrs.patch(
                    [{op: "remove",
                      path: `/category_i/${vnode.attrs.doc.category_i.indexOf(category)}`}
                    ].concat(
                        (registry.categories[category].attributes || []).filter(
                            (attr) =>
                            (vnode.attrs.doc[attr] || []).length > 0).map(
                                (attr) => ({op: "remove", path: `/${attr}`}))
                    ));
                vnode.state.active = undefined;
            }
        }

        function new_category(key) {
            return function() {
                vnode.attrs.patch(
                    (vnode.attrs.doc.category_i)?
                    [{op: "add", path: "/category_i/-", value: key}]
                    :
                    [{op: "add", path: "/category_i", value: [key]}]
                );
            };
        }

        function set_active(key) {
            return function() {
                vnode.state.active = key;
            }
        }

        return (vnode.attrs.edit)?null:[
            m("div.divider", {"data-content": "Categories"}),
            m("div.columns",

              m("div.menu.menu-nav.col-2",
                (vnode.attrs.doc.category_i || []).map(
                    (category) =>
                    m("li.menu-item",
                      m("a",
                        {"class": (vnode.state.active == category)?"active":"",
                         onclick: set_active(category)},
                        registry.categories[category].name),
                      m("div.menu-badge",
                        m("button.btn.btn-clear", {onclick: delete_category(category)})))
                     ),
                (new_categories.length > 0)?
                m("li.menu-item",
                  m("div.dropdown",
                    m("span.btn.btn-link.dropdown-toggle[tabindex=0]",
                      m("i.icon.icon-plus")),
                    m("ul.menu.text-left",
                      new_categories.map(
                          ([key, value]) =>
                          m("li.menu-item",
                            m("button.btn.btn-link", {onclick: new_category(key)}, value.name)
                           )
                      )
                     )
                   )
                 ):
                null
               ),
              m("div.column",
                (vnode.state.active && registry.categories[vnode.state.active].component)?
                m(registry.categories[vnode.state.active].component, {doc: vnode.attrs.doc, patch: vnode.attrs.patch, path: vnode.attrs.path})
                :null
               )
             )

        ]

    }
};


export const registry = {categories: {}};
export const top_widgets = [CategoryTabs];
