import {SidePanel} from "/static/sidepanel.js";

function random_char() {
    return '0123456789abcdef'[Math.floor(Math.random() * 16)];
}

function random_name() {
    return random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char();
}

function create_new_file(ext) {
    const path = `${random_name()}`;
    request(
        {method: "POST",
         url: m.buildPathname("/:path", {path}),
         headers: {"X-WOPI-Override": "X-LOTEK-CREATE"},
         body: {ext}}
    ).then(
        function (result) {
            m.route.set(m.buildPathname("/:path", {path}));
        },
        function (error) {
            if (error.code === 409) {
                create_new_file()
            }
        }
    );
}

const Menu = {
    oninit(vnode) {
        vnode.state.show_upload = false;
        vnode.state.uploading = false;
    },

    view(vnode) {
        function upload(e) {
            vnode.state.uploading = 0;
            let file = e.target.files[0];
            var body = new FormData();
            body.append("file", file);
            request({
                method: "POST",
                url: "/",
                body: body,
                config: function(xhr) {
                    xhr.upload.addEventListener(
                        "progress",
                        function(e) {
                            vnode.state.uploading = e.loaded / e.total;
                            m.redraw();
                        }
                    )
                }
            }).then(
                function(path) {
                    vnode.state.show_upload = false;
                    vnode.state.uploading = false;
                    m.route.set(m.buildPathname("/:path", {path}));
                }
            );
        }

        const path = window.location.pathname;
        return m(".container.column-flex", {style: "background: #f6f7f8;"},
                 m("nav",
                   registry.links.map(
                       (link) =>
                       m(m.route.Link,
                         {"class": (path === link.url)?"active":"",
                          href: link.url,
                          onclick: () => m.route.set(link.url)},
                         link.name
                        ))
                  ),
                 m(CUI.ControlGroup, {"class": "row-flex"},
                   m(CUI.PopoverMenu,
                     {closeOnContentClick: true,
                      style: 'flex-grow: 1;',
                      trigger:
                      m(CUI.Button,
                        {label: "New",
                         size: "sm",
                         fluid: true,
                         align: "left",
                         iconRight: CUI.Icons.CHEVRON_UP}),
                      content: FORMATS.map(
                          (format) =>
                          m(CUI.MenuItem,
                            {label: `${format.name} (.${format.ext})`,
                             onclick() { create_new_file(format.ext) }}
                           )
                      )
                     }),
                   m(CUI.Button,
                     {iconLeft: CUI.Icons.UPLOAD,
                      size: "sm",
                      label: "Upload",
                      onclick() { vnode.state.show_upload = true; }})
                  ),
                 m(CUI.Dialog,
                   {isOpen: vnode.state.show_upload,
                    onClose() { vnode.state.show_upload = false; },
                    title: "Upload",
                    content:
                    (vnode.state.uploading === false)?
                    m(CUI.InputFile, {fluid: true, onchange: upload}):
                    m("progress", {value: vnode.state.uploading, max: "1.0"})
                   }
                  )
                );
    }
};

const User = {
    oninit(vnode) {
        vnode.state.active = false;
        vnode.state.password = '';
        vnode.state.new_password = '';
        vnode.state.confirm = '';
        vnode.state.error = null;
    },

    view(vnode) {
        const span = {
            xs: 12,
            sm: 12,
            md: 6
        };

        let user_id = USER.id;

        function logout() {
            request(
                {method: "POST",
                 url: "/auth/logout"
                }
            ).then(
                function() {
                    USER = null;
                }
            );
        }

        function show_modal() {
            vnode.state.active = true;
        }

        function hide_modal() {
            vnode.state.active = false;
        }

        function onsubmit() {
            if (vnode.state.new_password !== vnode.state.confirm) {
                vnode.state.error = "Password mismatch";
                return;
            }
            request(
                {method: "POST",
                 url: "/auth/password/change",
                 body: {password: vnode.state.password,
                        new_password: vnode.state.new_password}
                }
            ).then(
                function(result) {
                    vnode.state.active = false;
                    vnode.state.password = '';
                    vnode.state.new_password = '';
                    vnode.state.confirm = '';
                    m.redraw();
                },
                function(error) {
                    vnode.state.error = "Change password failed";
                    m.redraw();
                }
            );
        }

        return [
            m(CUI.PopoverMenu,
              {closeOnContentClick: true,
               trigger: m(CUI.Button,
                          {basic: true,
                           size: "xs",
                           label:
                           [USER.display_name,
                            m(CUI.Icon, {name: CUI.Icons.CHEVRON_DOWN})]}),
               content: [
                   m(CUI.MenuItem,
                     {label: "Profile",
                      onclick: () => m.route.set(m.buildPathname("/~:user_id", {user_id}))}),
                   m(CUI.MenuItem,
                     {iconRight: CUI.Icons.EDIT,
                      label: "Change password",
                      onclick: show_modal}),
                   m(CUI.MenuItem,
                     {iconRight: CUI.Icons.LOG_OUT,
                      label: "Sign out",
                      onclick: () => logout()})
               ]},
             ),
            m(CUI.Dialog,
              {isOpen: vnode.state.active,
               onClose: hide_modal,
               title: "Change password",
               content: [
                   (vnode.state.error)?
                       m(CUI.Callout,
                         {intent: "negative",
                          header: vnode.state.error})
                       :null,
                   m(CUI.FormGroup, {span},
                     m(CUI.FormLabel, {for: 'password'}, "Password"),
                     m(CUI.Input,
                       {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                        type: "password",
                        id: 'password',
                        name: 'password',
                        fluid: true,
                        oninput: (e) => { vnode.state.password = e.target.value; },
                        value: vnode.state.password}
                      )
                    ),
                   m(CUI.FormGroup, {span},
                     m(CUI.FormLabel, {for: 'new_password'}, "New Password"),
                     m(CUI.Input,
                       {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                        type: "password",
                        id: 'new_password',
                        name: 'new_password',
                        fluid: true,
                        oninput: (e) => { vnode.state.new_password = e.target.value; },
                        value: vnode.state.new_password}
                      )
                    ),
                   m(CUI.FormGroup, {span},
                     m(CUI.FormLabel, {for: 'confirm'}, "Confirm New Password"),
                     m(CUI.Input,
                       {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                        type: "password",
                        id: 'confirm',
                        name: 'confirm',
                        fluid: true,
                        oninput: (e) => { vnode.state.confirm = e.target.value; },
                        value: vnode.state.confirm}
                      )
                    )
               ],
               footer: m(CUI.Button,
                         {label: "Submit",
                          intent: "primary",
                          onclick: onsubmit})
              }
             )
        ];
    }
};

const Layout = {
    oninit(vnode) {
        vnode.state.sidepanel_open = false;
    },

    view(vnode) {
        return m(SidePanel,
                 {isOpen: vnode.state.sidepanel_open,
                  panel: m(Menu)
                 },
                 m(".container.column-flex", {style: "background: #FFF;"},
                   m(".row-flex",
                     {style: "align-items: center;"},
                     m(CUI.Icon,
                       {name: CUI.Icons.MENU,
                        onclick() {
                            vnode.state.sidepanel_open = !vnode.state.sidepanel_open;
                        }
                       }
                      ),
                     m(CUI.ControlGroup,
                       {style: 'flex-grow: 1; justify-content: flex-end;'},
                       m(User))
                    ),
                   vnode.children
                  )
                );
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

function build_route(routes) {
    let result = new Proxy(
        {routes},
        {
            get(target, prop, receiver) {
                for (let [key, value] of target.routes)
                    if (key === prop)
                        return value;
            },
            getOwnPropertyDescriptor(target, prop) {
                return { configurable: true, enumerable: true};
            },
            ownKeys(target) {
                return target.routes.map(
                    ([key, value]) => key
                );
            }
        }
    );

    return result;
}

function main() {
    m.route.prefix = "";
    m.route(
        document.body,
        registry.links[0].url,
        build_route(
            registry.routes.map(
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
                         (USER)?m(Layout, value(vnode)):m(Authenticate)
                     ];
                  }}]
            ))
    );
}

export const registry = {
    routes: [],
    links: [],
    logins: []
};

export const onload = [main];
