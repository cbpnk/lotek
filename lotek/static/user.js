const Action = {
    oninit: function(vnode) {
        vnode.state.active = {};
        vnode.state.username = '';
        vnode.state.password = '';
        vnode.state.new_password = '';
        vnode.state.confirm = '';
        vnode.state.error = {};
    },

    view: function(vnode) {
        const span = {
            xs: 12,
            sm: 12,
            md: 6
        };

        let username = USER_ID;

        function logout() {
            USER_ID = null;
            m.request(
                {method: "POST",
                 url: "/auth/logout",
                 headers: {'X-CSRF-Token': CSRF_TOKEN},
                }
            );
        }

        function show_modal(name) {
            return function() {
                vnode.state.active[name] = true;
            }
        }

        function hide_modal(name) {
            return function() {
                vnode.state.active[name] = false;
            }
        }

        if (USER_ID) {
            function onsubmit() {
                if (vnode.state.new_password !== vnode.state.confirm) {
                    vnode.state.error["change-password"] = "Password mismatch";
                    return;
                }
                m.request(
                    {method: "POST",
                     url: "/auth/change-password",
                     body: {password: vnode.state.password, new_password: vnode.state.new_password},
                     headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                               'X-CSRF-Token': CSRF_TOKEN},
                    }
                ).then(
                    function(result) {
                        vnode.state.active["change-password"] = false;
                        vnode.state.password = '';
                        vnode.state.new_password = '';
                        vnode.state.confirm = '';
                        m.redraw();
                    },
                    function(error) {
                        vnode.state.error["change-password"] = "Change password failed";
                        m.redraw();
                    }
                );
            }

            return [
                m(CUI.PopoverMenu,
                  {closeOnContentClick: true,
                   trigger: m(CUI.Button,
                              {basic: true,
                               label:
                               [username,
                                m(CUI.Icon, {name: CUI.Icons.CHEVRON_DOWN})]}),
                   content: [
                       m(CUI.MenuItem,
                         {label: "Profile",
                          onclick: () => m.route.set(m.buildPathname("/~:username", {username}))}),
                       m(CUI.MenuItem,
                         {iconRight: CUI.Icons.EDIT,
                          label: "Change password",
                          onclick: show_modal("change-password")}),
                       m(CUI.MenuItem,
                         {iconRight: CUI.Icons.LOG_OUT,
                          label: "Sign out",
                          onclick: () => logout()})
                   ]},
                 ),
                m(CUI.Dialog,
                  {isOpen: vnode.state.active["change-password"],
                   onClose: hide_modal("change-password"),
                   title: "Change password",
                   content: [
                       m(CUI.FormGroup, {span},
                         m(CUI.FormLabel, {for: 'password'}, "Password"),
                         m(CUI.Input,
                           {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                            type: "password",
                            id: 'password',
                            name: 'password',
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
                            oninput: (e) => { vnode.state.confirm = e.target.value; },
                            value: vnode.state.confirm}
                          )
                        )
                   ],
                   footer: m(CUI.Button,
                             {label: "Submit",
                              onclick: onsubmit})
                  }
                 )
            ];
        }

        function onsubmit(e) {
            m.request(
                {method: "POST",
                 url: "/auth/login",
                 body: {username: vnode.state.username, password: vnode.state.password},
                 headers: {'X-CSRF-Token': CSRF_TOKEN},
                }
            ).then(
                function(result) {
                    USER_ID = result;
                    vnode.state.username = '';
                    vnode.state.password = '';
                    vnode.state.active["sign-in"] = false;
                    m.redraw();
                },
                function(error) {
                    vnode.state.error["sign-in"] = "Sign in failed";
                    m.redraw();
                }
            );
        }

        return [
            m(CUI.Button,
              {label: 'Sign in',
               onclick: show_modal("sign-in")}),
            m(CUI.Dialog,
              {isOpen: vnode.state.active["sign-in"],
               onClose: hide_modal("sign-in"),
               title: "Sign in",
               content: [
                   m(CUI.FormGroup, {span},
                     m(CUI.FormLabel, {for: 'username'}, "Username"),
                     m(CUI.Input,
                       {contentLeft: m(CUI.Icon, {name: CUI.Icons.USER}),
                        id: 'username',
                        name: 'username',
                        oninput: (e) => { vnode.state.username = e.target.value; },
                        value: vnode.state.username}
                      )
                    ),
                   m(CUI.FormGroup, {span},
                     m(CUI.FormLabel, {for: 'password'}, "Password"),
                     m(CUI.Input,
                       {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                        type: "password",
                        id: 'password',
                        name: 'password',
                        oninput: (e) => { vnode.state.password = e.target.value; },
                        value: vnode.state.password}
                      )
                    )
               ],
               footer: m(CUI.Button,
                         {label: "Submit",
                          onclick: onsubmit})
              }
             )
        ];
    }
};

export const actions = [Action];

export const searches = [{name: "Users", query: "category_i:user"}];
export const categories = {
    user: {
        name: "User",
        readonly: true}
};
