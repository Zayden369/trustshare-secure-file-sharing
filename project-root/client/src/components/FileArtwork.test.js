import {fileArtworkKind} from './FileArtwork';
test('file categories retain distinct silhouettes, including missing metadata',()=>{
  expect(['pdf','docx','pptx','xlsx','mp4','png','mp3','zip','json'].map(ext=>fileArtworkKind('sample.'+ext))).toEqual(['pdf','word','slides','grid','video','image','audio','archive','code']);
  expect(fileArtworkKind(null,null)).toBe('document');
});
