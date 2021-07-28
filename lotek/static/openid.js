import {get_token, clear_token} from "/static/auth.js";

const Action = {
    view: function(vnode) {
        let token = get_token();
        let email = token;

        function logout() {
            clear_token();
            m.redraw();
        }

        if (token) {
            let [username, domain] = email.split("@");
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
                      m("a", {onclick: logout}, "Sign out")
                     )
                   )
                 )
            ];
        }

        return [
            m("div.input-group.input-inline",
              m("a.btn.btn-sm", {href: m.buildPathname("/openid/redirect", {next: window.location.pathname})}, "Sign in"))
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
