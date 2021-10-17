const Layout = {
    view: function(vnode) {
        const path = window.location.pathname;

        return [
            vnode.children,
            m("header",
              m(CUI.Tabs,
                {align: "left",
                 bordered: true},
                registry.links.map(
                    (link) =>
                    m(CUI.TabItem,
                      {label: link.name,
                       active: path == link.url,
                       onclick: () => m.route.set(link.url)})
                ),
                m(CUI.ControlGroup,
                  {style: 'flex-grow: 1; justify-content: flex-end'},
                  registry.actions.map((action) => m(action)))
               )
             ),
            m("footer.py-2")
        ];
    }
};

const Authenticate = {
    oninit(vnode) {
        vnode.state.active = 0;
    },

    view(vnode) {
        return [
            m(CUI.Dialog,
              {title: "Log in",
               isOpen: true,
               hasCloseButton: false,
               content: [
                   m(CUI.Tabs,
                     {align: "left", bordered: true},
                     registry.logins.map(
                         (login, index) =>
                         m(CUI.TabItem,
                           {label: login.name,
                            active: vnode.state.active === index,
                            onclick: () => { vnode.state.active = index; } })
                     )
                    ),
                   m(registry.logins[vnode.state.active].component)
               ]
              }
             )
        ];
    }
};

function main() {
    m.route.prefix = "";
    m.route(
        document.body,
        registry.links[0].url,
        Object.fromEntries(
            Object.entries(registry.routes).map(
                ([key, value]) =>
                [key,
                 {render: function(vnode) {
                     return [
                         (start_retry)?
                             m(CUI.Toaster,
                               {clearOnEscapeKey: false,
                                toasts: [
                                    m(CUI.Toast,
                                      {timeout: 0,
                                       message: [
                                           "Something went wrong, ",
                                           m(CUI.Button,
                                             {label: "Try Again",
                                              onclick: start_retry})]
                                      })]})
                             :null,
                         (USER_ID)?m(Layout, value(vnode)):m(Authenticate)
                     ];
                  }}]
            ))
    );
}

export const registry = {
    routes: {},
    links: [],
    actions: [],
    logins: []
};

export const onload = [main];
