import {get_token} from "/static/user.js";

const Action = {
    oninit: function(vnode) {
        vnode.state.active = false;
        vnode.state.uploading = false;
    },

    view: function(vnode) {
        let token = get_token();
        if (!token)
            return;

        function random_char() {
            return '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }

        function random_name() {
            return random_char() + random_char() + random_char();
        }

        function create_new_file() {
            const path = `${random_name()}/${random_name()}/${random_name()}.txt`;
            m.request(
                {method: "PUT",
                 url: m.buildPathname("/files/:path...", {path}),
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': `Bearer ${token}`}}
            ).then(
                function (result) {
                    m.route.set(m.buildPathname("/view/:path...", {path}));
                },
                function (error) {
                    if (error.code === 409) {
                        create_new_file()
                    }
                }
            );
        }

        function upload(e) {
            vnode.state.uploading = 0;
            let file = e.target.files[0];
            var body = new FormData();
            body.append("file", file);
            m.request({
                method: "POST",
                url: "/files/",
                body: body,
                config: function(xhr) {
                    xhr.upload.addEventListener(
                        "progress",
                        function(e) {
                            vnode.state.uploading = e.loaded / e.total;
                            m.redraw();
                        }
                    )
                },
                headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                          'Authorization': `Bearer ${token}`}
            }).then(
                function(path) {
                    vnode.state.active = false;
                    vnode.state.uploading = false;
                    m.route.set(m.buildPathname("/view/:path...", {path}));
                }
            );

            m.redraw();
        }

        function show_modal() {
            vnode.state.active = true;
        }

        function hide_modal() {
            vnode.state.active = false;
        }

        return [
            m("div.dropdown.text-left",
              m("span.btn.btn-link.dropdown-toggle[tabindex='0']",
                m("i.icon.icon-plus"),
                m("i.icon.icon-caret")
               ),
              m("ul.menu",
                m("li.menu-item",
                  m("button.btn.btn-link",
                    {onclick: create_new_file},
                    "New")),
                m("li.menu-item",
                  m("button.btn.btn-link",
                    {onclick: show_modal},
                    "Upload"))
               )
             ),
            m("div.modal.text-left",
              {"class": vnode.state.active?"active":""},
              m("a.modal-overlay", {onclick: hide_modal}),
              m("div.modal-container",
                m("div.modal-header",
                  m("button.btn.btn-clear.float-right", {onclick: hide_modal}),
                  m("div.modal-title", "Upload")
                 ),
                m("div.modal-body",
                  m("div.empty",
                    (vnode.state.uploading === false)?
                    m("input[type='file']", {onchange: upload})
                    :
                    m("progress.progress", {value: vnode.state.uploading, max: "1.0"})
                   )
                 )
               )
             )
        ]

    }
}

export const actions = [Action];
