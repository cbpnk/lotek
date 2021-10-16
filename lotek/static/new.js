const Action = {
    oninit: function(vnode) {
        vnode.state.active = false;
        vnode.state.uploading = false;
    },

    view: function(vnode) {
        if (!USER_ID)
            return;

        function random_char() {
            return '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }

        function random_name() {
            return random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char() + random_char();
        }

        function create_new_file() {
            const path = `${random_name()}.txt`;
            m.request(
                {method: "PUT",
                 url: m.buildPathname("/:path", {path}),
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                           'X-CSRF-Token': CSRF_TOKEN}}
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

        function upload(e) {
            vnode.state.uploading = 0;
            let file = e.target.files[0];
            var body = new FormData();
            body.append("file", file);
            m.request({
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
                },
                headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                          'X-CSRF-Token': CSRF_TOKEN}
            }).then(
                function(path) {
                    vnode.state.active = false;
                    vnode.state.uploading = false;
                    m.route.set(m.buildPathname("/:path", {path}));
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
            m(CUI.PopoverMenu,
              {closeOnContentClick: true,
               trigger:
               m(CUI.Button,
                 {basic: true,
                  label: m(CUI.Icon, {name: CUI.Icons.PLUS})}),
               content: [
                   m(CUI.MenuItem,
                     {label: "New",
                      onclick: create_new_file}),
                   m(CUI.MenuItem,
                     {label: "Upload",
                      iconRight: CUI.Icons.UPLOAD,
                      onclick: show_modal}),
               ]
              }
             ),
            m(CUI.Dialog,
              {isOpen: vnode.state.active,
               onClose: hide_modal,
               title: "Upload",
               content: (vnode.state.uploading === false)?m(CUI.InputFile, {onchange: upload}):m("progress.progress", {value: vnode.state.uploading, max: "1.0"})}
             )
        ];
    }
}

export const actions = [Action];
