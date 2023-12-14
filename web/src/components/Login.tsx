import * as React from "react";

interface Props {
  partyId: string;
  handleSubmit: React.FormEventHandler;
  handleUserInput: React.ChangeEventHandler<HTMLInputElement>;
  handleTokenInput: React.ChangeEventHandler<HTMLInputElement>;
  token: string;
}

const Login = (props: Props) => {
  const { partyId, handleSubmit, handleUserInput, handleTokenInput, token } =
    props;

  return (
    <div className="login-container">
      <div className="login">
        <form className="login-form" onSubmit={handleSubmit}>
          <a className="submit-btn dabl-login" href="/.hub/v2/auth/login">
            Log In with Daml Hub
          </a>
          <label className="username-label" htmlFor="username">
            OR
          </label>
          <label className="username-label" htmlFor="username">
            Party
          </label>
          <input
            className="username-input"
            type="text"
            id="username"
            name="partyId"
            value={partyId}
            onChange={handleUserInput}
            placeholder="Party ID"
          />
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
