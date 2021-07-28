import {get_token, set_token, clear_token} from "/static/auth.js";

const Action = {
    oninit: function(vnode) {
        vnode.state.active = {};
        vnode.state.email = '';
        vnode.state.password = '';
        vnode.state.new_password = '';
        vnode.state.confirm = '';
        vnode.state.error = {};
    },

    view: function(vnode) {
        let token = get_token();
        let email = token;

        function logout() {
            clear_token();
            m.redraw();
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

        if (token) {
            let [username, domain] = email.split("@");

            function onsubmit(e) {
                e.preventDefault();
                if (vnode.state.new_password !== vnode.state.confirm) {
                    vnode.state.error["change-password"] = "Password mismatch";
                    return;
                }
                m.request(
                    {method: "POST",
                     url: "/change-password",
                     body: {password: vnode.state.password, new_password: vnode.state.new_password},
                     headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                               'Authorization': `Bearer ${token}`},
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
                m("div.dropdown.text-left",
                  m("button.btn.btn-link.btn-sm.dropdown-toggle[tabindex='0']",
                    email,
                    m("i.icon.icon-caret")
                   ),
                  m("ul.menu",
                    m("li.menu-item",
                      m(m.route.Link,
                        {href: m.buildPathname("/view/:path...", {path: `users/${domain}/${username}.txt`})},
                        "Profile"
                       )
                     ),
                    m("li.menu-item",
                      m("a", {onclick: show_modal("change-password")}, "Change Password")
                     ),
                    m("li.menu-item",
                      m("a", {onclick: logout}, "Sign out")
                     )
                   )
                 ),

                m("div.modal.text-left",
                  {"class": vnode.state.active["change-password"]?"active":""},
                  m("a.modal-overlay", {onclick: hide_modal("change-password")}),
                  m("div.modal-container",
                    m("div.modal-header",
                      m("button.btn.btn-clear.float-right", {onclick: hide_modal("change-password")}),
                      m("div.modal-title", "Change Password")
                     ),
                    m("div.modal-body",
                      m("form", {onsubmit},
                        (vnode.state.error["change-password"])?m("div.toast.toast-error", vnode.state.error["change-password"]):null,
                        m("div.form-group",
                          m("label.form-label", "Password"),
                          m("input.form-input[type=password]",
                            {oninput: function(e) { vnode.state.password = e.target.value; },
                             value: vnode.state.password})
                         ),
                        m("div.form-group",
                          m("label.form-label", "New Password"),
                          m("input.form-input[type=password]",
                            {oninput: function(e) { vnode.state.new_password = e.target.value; },
                             value: vnode.state.new_password})
                         ),
                        m("div.form-group",
                          m("label.form-label", "Confirm"),
                          m("input.form-input[type=password]",
                            {oninput: function(e) { vnode.state.confirm = e.target.value; },
                             value: vnode.state.confirm}),
                         ),
                        m("div.form-group",
                          m("button.form-input.btn.btn-primary", "Submit")
                         )
                       )
                     )
                   )
                 )
            ];
        }

        function onsubmit(e) {
            e.preventDefault();
            m.request(
                {method: "POST",
                 url: "/authenticate",
                 body: {email: vnode.state.email, password: vnode.state.password},
                }
            ).then(
                function(result) {
                    set_token(result);
                    vnode.state.email = '';
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
            m("div.input-group.input-inline",
              m("button.btn.btn-sm", {onclick: show_modal("sign-in")}, "Sign in")),
            m("div.modal.text-left",
              {"class": vnode.state.active["sign-in"]?"active":""},
              m("a.modal-overlay", {onclick: hide_modal("sign-in")}),
              m("div.modal-container",
                m("div.modal-header",
                  m("button.btn.btn-clear.float-right", {onclick: hide_modal("sign-in")}),
                  m("div.modal-title", "Sign in")
                 ),
                m("div.modal-body",
                  m("form", {onsubmit},
                    (vnode.state.error["sign-in"])?m("div.toast.toast-error", vnode.state.error["sign-in"]):null,
                    m("div.form-group",
                      m("label.form-label", "Email"),
                      m("input.form-input[type=email]",
                        {oninput: function(e) { vnode.state.email = e.target.value; },
                         value: vnode.state.email})
                     ),
                    m("div.form-group",
                      m("label.form-label", "Password"),
                      m("input.form-input[type=password]",
                        {oninput: function(e) { vnode.state.password = e.target.value; },
                         value: vnode.state.password}),
                     ),
                    m("div.form-group",
                      m("button.form-input.btn.btn-primary", "Submit")
                     )
                   )
                 )
               )
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
