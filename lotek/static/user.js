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
            function onsubmit(e) {
                e.preventDefault();
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

            return html`
<div class="dropdown dropdown-right text-left">
  <button class="btn btn-link btn-sm dropdown-toggle" tabindex="0">
    ${ username }
    <i class="icon icon-caret" />
  </button>
  <ul class="menu">
    <li class="menu-item">
      <${m.route.Link} href=${ m.buildPathname("/~:username", {username}) }>Profile<//>
    </li>
    <li class="menu-item">
      <a onclick=${ show_modal("change-password") }>Change password</a>
    </li>
    <li class="menu-item">
      <a onclick=${ logout }>Sign out</a>
    </li>
  </ul>
</div>
<div class="modal text-left ${ vnode.state.active["change-password"]?"active":"" }">
  <a class="modal-overlay" onclick=${ hide_modal("change-password") }></a>
  <div class="modal-container">
    <div class="modal-header">
      <button class="btn btn-clear float-right" onclick=${ hide_modal("change-password") }></button>
      <div class="modal-title">Change Password</div>
    </div>
    <div class="modal-body">
      <form onsubmit=${ onsubmit }>
        ${ vnode.state.error["change-password"]?html`<div class="toast toast-error">${ vnode.state.error["change-password"] }</div>`:null }
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" type="password" oninput=${ function(e) { vnode.state.password = e.target.value; } } value="${ vnode.state.password }" />
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-input" type="password" oninput=${ function(e) { vnode.state.new_password = e.target.value; } } value="${ vnode.state.new_password }" />
        </div>
        <div class="form-group">
          <label class="form-label">Confirm</label>
          <input class="form-input" type="password" oninput=${ function(e) { vnode.state.confirm = e.target.value; } } value="${ vnode.state.confirm }" />
        </div>
        <div class="form-group">
          <button class="form-input btn btn-primary">Submit</button>
        </div>
      </form>
    </div>
  </div>
</div>`;
        }

        function onsubmit(e) {
            e.preventDefault();
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

        return html`
<div class="input-group input-inline">
  <button class="btn btn-sm" onclick=${ show_modal("sign-in") }>Sign in</button>
</div>
<div class="modal text-left ${ vnode.state.active["sign-in"]?"active":"" }">
  <a class="modal-overlay" onclick=${ hide_modal("sign-in") }></a>
  <div class="modal-container">
    <div class="modal-header">
      <button class="btn btn-clear float-right" onclick=${ hide_modal("sign-in") }></button>
      <div class="modal-title">Sign in</div>
    </div>
    <div class="modal-body">
      <form onsubmit=${ onsubmit }>
        ${ vnode.state.error["sign-in"]?html`<div class="toast toast-error">${ vnode.state.error["sign-in"] }</div>`:null }
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" oninput=${ function(e) { vnode.state.username = e.target.value; } } value="${ vnode.state.username }" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" type="password" oninput=${ function(e) { vnode.state.password = e.target.value; } } value="${ vnode.state.password }" />
        </div>
        <div class="form-group">
          <button class="form-input btn btn-primary">Submit</button>
        </div>
      </form>
    </div>
  </div>
</div>`;
    }
};

export const actions = [Action];

export const searches = [{name: "Users", query: "category_i:user"}];
export const categories = {
    user: {
        name: "User",
        readonly: true}
};
