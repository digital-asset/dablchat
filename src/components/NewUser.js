import React from 'react';
import TERMS_AND_CONDITIONS from '../termsAndConditions';

const NewUser = props => {
  const { partyName, handleAcceptInvitation } = props;

  return (
    <div className="login-container">
      <div className="login">
        <div className="login-form">
          <h4 htmlFor="username">
            {`Hello ${partyName},`}
          </h4>
          <h4>Welcome to DABL Chat!</h4>
          <span>Please Accept the terms of service to continue</span>
          <div className="terms-legal-text"
                dangerouslySetInnerHTML={{__html: TERMS_AND_CONDITIONS}}/>
          <button className="submit-btn" onClick={handleAcceptInvitation}>
            Accept Terms and Conditions
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewUser;
