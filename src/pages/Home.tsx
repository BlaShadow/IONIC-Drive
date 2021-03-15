import { IonButton, IonContent, IonHeader, IonIcon, IonImg, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import './Home.css';
import GoogleButton from 'react-google-button'
import React, { useEffect, useState } from 'react';
import firebase from 'firebase';
import axios from 'axios';
import { AuthResponse, BasicProfile } from './types';
import { setSyntheticLeadingComments } from 'typescript';
import {folderOpenOutline, documentOutline, imageOutline} from 'ionicons/icons';
import { FilesystemDirectory } from '@capacitor/core';

///<reference path="gapi" />

const scope = 'email profile openid https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive';

type OptionalValue<T> = T | undefined;

interface RawItemFile {
  id: string;
  kind: string;
  mimeType: string;
  name: string;
}

type ItemFileType = 'folder' | 'document';

type FilterValue = 'all' | 'files' | 'folders';

interface ItemFile {
  docType: ItemFileType;
  name: string;
  id: string;
}

const PROJECT_KEY = '';
const CLIENT_ID = '';

interface UploadButtonProps {
  onSelectedFile: (file: File) => void;
}

const UploadButton = (props: UploadButtonProps) => {
  const [inputElement, setInputElement] = useState<OptionalValue<HTMLInputElement>>();
  const [selectedFile, setSelectedFile] = useState<OptionalValue<File>>();

  useEffect(() => {
    if (selectedFile !== undefined) {
      props.onSelectedFile(selectedFile);
    }
  },[selectedFile]) 

  return (
    <IonButton onClick={() => inputElement?.click()} expand="block">
      <input
        accept="image/*"
        hidden
        ref={input => (input !== null ? setInputElement(input) : null)}
        type="file"
        onChange={e => {
          setSelectedFile((e.nativeEvent.target as HTMLInputElement).files?.item(0) || ({} as File));
        }}
      />
      <IonIcon slot="start" icon={imageOutline} />
      Choose Image
    </IonButton>
  );
}

const Home: React.FC = () => {
  const [status, setStatus] = useState('');
  const [googleAuthObject, setGoogleAuthObject] = useState<any | undefined>(undefined);
  const [authAccess, setAuthAccess] = useState<AuthResponse | undefined>(undefined);
  const [basicProfile, setBasicProfile] = useState<OptionalValue<BasicProfile>>(undefined);
  const [docs, setDocs] = useState<ItemFile[]>([]);
  const [filterValue, setFilterValue] = useState<FilterValue>('all');

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/platform.js";
    document.body.appendChild(script);

    script.onload = () => { 
      window.gapi.load('auth2', function() {  
        const api = window.gapi as any;

        // gapi.auth2.GoogleAuth
        const googleAuth: Promise<any> = api.auth2.init({
          client_id: CLIENT_ID,
          scope,
        });

        setGoogleAuthObject(googleAuth);

        googleAuth.then((result) => {
          console.log('Google Auth object resolve ' + result);
        })
        .catch((error) => {
          console.error(error);
        });

        if (googleAuth !== undefined && (googleAuth as any).currentUser) {
          (googleAuth as any).currentUser.listen((userResult: any) => {

            if (googleAuthObject !== undefined && (googleAuthObject as any).currentUser) {
              const currentUser = googleAuthObject.currentUser.get();
    
              if (currentUser !== undefined) {
                console.info(currentUser);
              }
            }
          })
        }
      });
    }
  }, []);

  const signIn = () => {
    const promise: Promise<any> = googleAuthObject.signIn({scope})

    promise
      .then((result) => {
        const user = result;
        const basicProfile: BasicProfile = user.getBasicProfile();

        setBasicProfile(basicProfile);

        const newPromise: Promise<AuthResponse> = user.reloadAuthResponse()

        newPromise.then((access) => {
          setAuthAccess(access);
        });
      })
      .catch((error) => {
        console.error(error);
      });
  }

  const UpdateFileMetaData = (fileId: string, name: string, mimeType: string): Promise<any> => {
    const url = 'https://content.googleapis.com/drive/v2/files/' + fileId + '/copy';
    const requestBodyData = {
      mimeType: mimeType, 
      originalFilename: name,
      title: `${Date.now()}-${name}`
    }

    const queryParams = {
      'alt': 'json',
      'key': PROJECT_KEY
    };

    return axios.post(url, requestBodyData, {
      params: queryParams,
      headers: {
        'authorization': 'Bearer ' + authAccess?.access_token ?? 'NONE'
      }
    });
  }

  const uploadFile = (file: File) => {
    var formData = new FormData();
    formData.append("media", file);

    axios.post('https://www.googleapis.com/upload/drive/v3/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'authorization': 'Bearer ' + authAccess?.access_token ?? 'NONE'
      },
      params: {
        uploadType: 'media'
      }
    })
    .then((result) => {
      console.log('Upload success ' + result);
      const fileId = result.data.id;

      return UpdateFileMetaData(fileId, file.name, file.type);
    })
    .then((result) => {
      console.log('Update file ' + result);
    })
    .catch((error) => {
      console.error('Error uploading file ' + error);
    });
  }

  const fetchFiles = () =>  {
    setStatus('Fetching files....');
    const url = 'https://www.googleapis.com/drive/v3/files';
    const params = {
      'q': "'root' in parents",
      'key': PROJECT_KEY
    };
    const headers = {
      'authorization': 'Bearer ' + authAccess?.access_token ?? 'NONE'
    }

    axios({
      url,
      headers,
      params
    }).then((result) => {
      setStatus('Fetching files done');
      const files: RawItemFile[] = result.data.files;

      const cleanResult = files.map((item) => {
        const docType: ItemFileType = item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'document';
        const itemResult: ItemFile = {
          ...item,
          docType,
        };

        return itemResult;
      })

      setDocs(cleanResult);
    }).catch((error) => {
      setStatus('Fetching files Error :(');
    })
  }

  const filesResult = docs.filter((item) => {
    if (filterValue === 'all') {
      return true;
    }

    if (filterValue === 'files' && item.docType === 'document') {
      return true;
    }

    if (filterValue === 'folders' && item.docType === 'folder') {
      return true;
    }

    return false;
  });

  console.log('Filter values', filesResult.length, docs.length);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Blank</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', height: '100%'}}>
          { (basicProfile !== undefined) &&
            <div>
              <b>{status}</b>
              <IonImg src={basicProfile.getImageUrl()} style={{width: 100, height: 100}} />
              <h4>{basicProfile.getGivenName()}</h4>
              <h4>{basicProfile.getEmail()}</h4>

              <div>
                <IonButton onClick={fetchFiles}>Fetch Files</IonButton>
                <UploadButton onSelectedFile={uploadFile} />
              </div>
            </div>
          }

          {docs.length > 0 &&
            <IonSegment onIonChange={e => setFilterValue(e.detail.value as any)} value={filterValue}>
              <IonSegmentButton value="all">
                <IonLabel>Todos</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="folders">
                <IonLabel>Directorios</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="files">
                <IonLabel>Archivos</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          }

          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center'}}>
            {filesResult.map((item, index) => {
              return (
                <div key={index} style={{display: 'flex', alignItems: 'center', margin: 2, padding: 2, width: 200, height: 30, overflow: 'hidden', backgroundColor: '#F0F0F0', borderRadius: 5}}>
                  {item.docType === 'document' && <IonIcon icon={documentOutline} />}
                  {item.docType === 'folder' && <IonIcon icon={folderOpenOutline} />}
                  {item.name.substr(0, 20)}{item.name.length >= 20 ? '...' : ''}
                </div>
              );
            })}
          </div>

        { (basicProfile === undefined) &&
          <GoogleButton
          style={{marginTop: 30}}
            onClick={signIn}
          />
        }
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
