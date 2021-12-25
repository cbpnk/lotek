const Login = {
    oninit(vnode) {
        vnode.state.user_id = '';
        vnode.state.password = '';
        vnode.state.error = null;
    },

    view(vnode) {
        const span = {
            xs: 12,
            sm: 12,
            md: 6
        };

        function onsubmit(e) {
            request(
                {method: "POST",
                 url: "/auth/password/login",
                 body: {user_id: vnode.state.user_id, password: vnode.state.password}
                }
            ).then(
                function(result) {
                    USER = result;
                    vnode.state.user_id = '';
                    vnode.state.password = '';
                },
                function(error) {
                    vnode.state.error = "Log in failed";
                }
            );
        }

        return [
            (vnode.state.error)?
                m(CUI.Callout,
                  {intent: "negative",
                   header: vnode.state.error})
                :null,
            m(CUI.FormGroup, {span},
              m(CUI.FormLabel, {for: 'user_id'}, "User ID"),
              m(CUI.Input,
                {contentLeft: m(CUI.Icon, {name: CUI.Icons.USER}),
                 id: 'user_id',
                 name: 'user_id',
                 fluid: true,
                 oninput(e) { vnode.state.user_id = e.target.value; },
                 value: vnode.state.user_id}
               )
             ),
            m(CUI.FormGroup, {span},
              m(CUI.FormLabel, {for: 'password'}, "Password"),
              m(CUI.Input,
                {contentLeft: m(CUI.Icon, {name: CUI.Icons.LOCK}),
                 type: "password",
                 id: 'password',
                 name: 'password',
                 fluid: true,
                 oninput(e) { vnode.state.password = e.target.value; },
                 value: vnode.state.password}
               )
             ),
            m(CUI.FormGroup, {span},
              m(CUI.Button,
                {label: "Log in",
                 intent: "primary",
                 onclick: onsubmit}))
        ];
    }
};

export const logins = [
    {name: "Password",
     component: Login
    }
];
