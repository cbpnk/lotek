const CategoryTabs = {
    oninit: function(vnode) {
        vnode.state.active = (vnode.attrs.doc.category_i || [])[0];
    },

    view: function(vnode) {
        const new_categories = Object.entries(registry.categories).filter(
            ([key, value]) => !(vnode.attrs.doc.category_i || []).includes(key) && !value.readonly);

        function delete_category(category) {
            return function() {
                vnode.state.active = undefined;
                vnode.attrs.patch(
                    [{op: "remove",
                      path: `/category_i/${vnode.attrs.doc.category_i.indexOf(category)}`}
                    ].concat(
                        Object.keys(vnode.attrs.doc).filter(
                            (attr) =>
                            attr.startsWith(`${category}__`)
                        ).map(
                            (attr) =>
                            ({op: "remove", path: `/${attr}`}))
                    )).then(
                        function(doc) {
                            vnode.state.active = (doc.category_i || [])[0];
                        }
                    );
            }
        }

        function new_category(key) {
            return function() {
                vnode.attrs.patch(
                    (vnode.attrs.doc.category_i)?
                    [{op: "add", path: "/category_i/-", value: key}]
                    :
                    [{op: "add", path: "/category_i", value: [key]}]
                ).then(
                    function(doc) {
                        if (!vnode.state.active)
                            vnode.state.active = (doc.category_i || [])[0];
                    }
                );
            }
        }

        function set_active(key) {
            return function() {
                vnode.state.active = key;
            }
        }

        return [
            m(CUI.Tabs,
              {align: "left",
               bordered: true},
              (vnode.attrs.doc.category_i || []).map(
                  (category) =>
                  m(CUI.TabItem,
                    {label: [
                        registry.categories[category].name,
                        ((!vnode.attrs.patch) || registry.categories[category].readonly)?null:
                            m(CUI.Button,
                              {basic: true,
                               compact: true,
                               size: 'sm',
                               onclick: () => delete_category(category),
                               label: m(CUI.Icon, {name: CUI.Icons.X})}
                             )
                    ],
                     active: vnode.state.active === category}
                   )
              ),
              m(CUI.ControlGroup,
                {style: 'flex-grow: 1; justify-content: flex-end'},
                m(CUI.PopoverMenu,
                  {closeOnContentClick: true,
                   trigger:
                   m(CUI.Button,
                     {basic: true,
                      label: m(CUI.Icon, {name: CUI.Icons.PLUS})}
                    ),
                   content: new_categories.map(
                       ([key, value]) =>
                       m(CUI.MenuItem,
                         {label: value.name,
                          onclick: new_category(key)})
                   )
                  }
                 )
               )
             ),
            (vnode.state.active && registry.categories[vnode.state.active].component)?
                m(registry.categories[vnode.state.active].component,
                  {key: vnode.attrs.active, doc: vnode.attrs.doc, patch: vnode.attrs.patch, path: vnode.attrs.path})
                :null
        ];
    }
};


export const registry = {categories: {}};
export const left_widgets = [CategoryTabs];
