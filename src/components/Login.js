import React from 'react';

const Login = props => {
  const { partyId, handleSubmit, handleUserInput, handleTokenInput, token } = props;

  const showLoginWithDABL = window.location.hostname !== 'localhost';

  const loginUrl = (showLoginWithDABL && "/.hub/v1/auth/login") || ""

  return (
    <div className="login-container">
      <div className="login">
        <form className="login-form" onSubmit={handleSubmit}>
          {showLoginWithDABL && (
            <>
              <a className="submit-btn dabl-login" href={`${loginUrl}`}>Log In with Daml Hub</a>
              <label className="username-label" style={{"text-align": "center", "margin-top" : "10px"}} htmlFor="username">
                OR
              </label>
            </>)}
          <label className="username-label" htmlFor="username">
            Party
          </label>
          <input className="username-input" type="text" id="username" name="partyId" value={partyId} onChange={handleUserInput} placeholder="Party ID"/>
          <label className="username-label" htmlFor="username">
            Token
          </label>
          <input
            id="secret"
            className="username-input"
            autoFocus
            type="password"
            name="token"
            value={token}
            onChange={handleTokenInput}
            placeholder="Party JWT"
          />
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
