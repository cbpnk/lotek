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

            return html`
<div class="dropdown text-left">
  <button class="btn btn-link btn-sm dropdown-toggle" tabindex="0">
    ${ email }
    <i class="icon icon-caret" />
  </button>
  <ul class="menu">
    <li class="menu-item">
      <${m.route.Link} href=${ m.buildPathname("/view/:path...", {path: `users/${domain}/${username}.txt`}) }>Profile<//>
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
          <label class="form-label">Email</label>
          <input class="form-input" type="email" oninput=${ function(e) { vnode.state.email = e.target.value; } } value="${ vnode.state.email }" />
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
