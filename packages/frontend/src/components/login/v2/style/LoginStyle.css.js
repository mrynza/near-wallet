import styled from 'styled-components';

export default styled.div`
    &&& {
        h3, .desc {
            text-align: center;
        }
    
        h3 {
            color: black;
            line-break: anywhere;
        }
    
        .desc {
            color: #72727A;
            line-height: 150%;
            margin: 15px 0 30px 0;
    
            b {
                color: #3F4045;
            }
        }
    
        &.confirm-login {
            .desc {
                margin-bottom: 50px;
            }
        }
    
        .button-group {
            margin-top: 30px;
        }
    
        .swap-graphic {
            margin: 0 auto 35px auto;
            display: block;
        }
    
        .alert-banner {
            margin: 55px 0 -15px 0;

            > div {
                font-style: normal;
            }
        }
    }
`;