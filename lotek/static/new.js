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

        return html`
<div class="dropdown text-left">
  <span class="btn btn-link dropdown-toggle" tabindex="0">
    <i class="icon icon-plus" />
    <i class="icon icon-caret" />
  </span>
  <ul class="menu">
    <li class="menu-item">
      <button class="btn btn-link" onclick=${ create_new_file }>New</button>
    </li>
    <li class="menu-item">
      <button class="btn btn-link" onclick=${ show_modal }>Upload</button>
    </li>
  </ul>
</div>
<div class="modal text-left ${ vnode.state.active?"active":"" }">
  <a class="modal-overlay" onclick=${ hide_modal } />
  <div class="modal-container">
    <div class="modal-header">
      <button class="btn btn-clear float-right" onclick=${ hide_modal }></button>
      <div class="modal-title">Upload</div>
    </div>
    <div class="modal-body">
      <div class="empty">
        ${ (vnode.state.uploading === false)?
           html`<input type="file" onchange=${upload} />`:
           html`<progress class="progress" value="${vnode.state.uploading}" max="1.0" />`
        }
      </div>
    </div>
  </div>
</div>`;
    }
}

export const actions = [Action];
