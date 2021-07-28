export function get_token() {
    return localStorage.getItem('token');
}

export function set_token(token) {
    return localStorage.setItem('token', token);
}

export function clear_token() {
    localStorage.clear();
}
